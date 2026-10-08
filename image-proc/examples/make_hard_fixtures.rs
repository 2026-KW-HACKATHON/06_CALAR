//! 깨끗한 간판 이미지(backend/test/fixtures/signs)를 "휴대폰으로 찍은 것 같은" 사진으로 망가뜨린다.
//! image-proc 효과를 재현 가능하게 측정하기 위한 개발용 도구다. 실제 사진 검증을 대신하지는 못한다.
//!
//! 사용: cargo run --release --example make_hard_fixtures -- <원본 폴더> <출력 폴더> [시드]
//! 시드를 바꾸면 배경·왜곡·잡음이 다른 세트가 만들어진다 (튜닝에 안 쓴 검증용 세트를 만들 때)
//!
//! 만드는 종류 (파일 이름 뒤에 붙음)
//! - scene : 어수선한 거리 배경 속에 원근 왜곡된 간판 + 조명 기울기 (JPEG)
//! - far   : 멀리서 찍어 간판이 사진의 일부만 차지 (큰 JPEG)
//! - shadow: 강한 그림자(밝기 기울기) + 낮은 대비 + 잡음 (PNG)
//! - blur  : 흔들림(흐림) + 잡음 + 저화질 JPEG
//! - isolum: 글자와 바탕의 밝기는 같고 색만 다른 간판 (PNG)
//! - exif  : 픽셀은 눕혀 저장하고 EXIF(리틀엔디언, 안드로이드 방식)에 회전 정보만 기록 (JPEG)

use image::codecs::jpeg::JpegEncoder;
use image::{imageops, DynamicImage, ImageFormat, Rgb, RgbImage};
use std::path::{Path, PathBuf};
use std::{env, fs};

struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn f(&mut self) -> f32 {
        (self.next() >> 40) as f32 / (1u64 << 24) as f32
    }
    fn range(&mut self, lo: f32, hi: f32) -> f32 {
        lo + (hi - lo) * self.f()
    }
    fn gauss(&mut self) -> f32 {
        let (u1, u2) = (self.f().max(1e-7), self.f());
        (-2.0 * u1.ln()).sqrt() * (std::f32::consts::TAU * u2).cos()
    }
}

fn clamp_u8(v: f32) -> u8 {
    v.round().clamp(0.0, 255.0) as u8
}

/// 하늘·건물·창문 느낌의 어수선한 배경
fn clutter(w: u32, h: u32, rng: &mut Rng) -> RgbImage {
    let mut img = RgbImage::from_fn(w, h, |_, y| {
        let t = y as f32 / h as f32;
        Rgb([clamp_u8(170.0 - 80.0 * t), clamp_u8(180.0 - 90.0 * t), clamp_u8(200.0 - 110.0 * t)])
    });
    for _ in 0..60 {
        let (rw, rh) = (rng.range(0.03, 0.25) * w as f32, rng.range(0.03, 0.3) * h as f32);
        let (x0, y0) = (rng.range(0.0, w as f32 - rw), rng.range(0.0, h as f32 - rh));
        let color = Rgb([rng.range(30.0, 230.0) as u8, rng.range(30.0, 230.0) as u8, rng.range(30.0, 230.0) as u8]);
        for y in y0 as u32..(y0 + rh) as u32 {
            for x in x0 as u32..(x0 + rw) as u32 {
                img.put_pixel(x, y, color);
            }
        }
    }
    img
}

/// 4점 대응으로 원근 변환 행렬을 구한다 (dst 좌표 → src 좌표, 8x8 연립방정식)
fn homography(dst: [(f32, f32); 4], src: [(f32, f32); 4]) -> [f64; 9] {
    let mut a = [[0f64; 9]; 8];
    for i in 0..4 {
        let (x, y) = (dst[i].0 as f64, dst[i].1 as f64);
        let (u, v) = (src[i].0 as f64, src[i].1 as f64);
        a[2 * i] = [x, y, 1.0, 0.0, 0.0, 0.0, -u * x, -u * y, u];
        a[2 * i + 1] = [0.0, 0.0, 0.0, x, y, 1.0, -v * x, -v * y, v];
    }
    for col in 0..8 {
        let pivot = (col..8).max_by(|&i, &j| a[i][col].abs().total_cmp(&a[j][col].abs())).unwrap();
        a.swap(col, pivot);
        let pivot_row = a[col];
        for (row, line) in a.iter_mut().enumerate() {
            if row != col {
                let f = line[col] / pivot_row[col];
                for (value, &p) in line.iter_mut().zip(pivot_row.iter()).skip(col) {
                    *value -= f * p;
                }
            }
        }
    }
    let mut h = [0f64; 9];
    for i in 0..8 {
        h[i] = a[i][8] / a[i][i];
    }
    h[8] = 1.0;
    h
}

fn sample(img: &RgbImage, x: f32, y: f32) -> Option<[f32; 3]> {
    let (w, h) = (img.width() as f32, img.height() as f32);
    if x < 0.0 || y < 0.0 || x > w - 1.0 || y > h - 1.0 {
        return None;
    }
    let (x0, y0) = (x.floor() as u32, y.floor() as u32);
    let (x1, y1) = ((x0 + 1).min(img.width() - 1), (y0 + 1).min(img.height() - 1));
    let (fx, fy) = (x - x0 as f32, y - y0 as f32);
    Some([0, 1, 2].map(|c| {
        let p = |xx, yy| img.get_pixel(xx, yy)[c] as f32;
        (p(x0, y0) * (1.0 - fx) + p(x1, y0) * fx) * (1.0 - fy) + (p(x0, y1) * (1.0 - fx) + p(x1, y1) * fx) * fy
    }))
}

/// 간판을 배경 위 사각형(quad)에 원근 왜곡해서 붙인다
fn paste_perspective(bg: &mut RgbImage, sign: &RgbImage, quad: [(f32, f32); 4]) {
    let (sw, sh) = (sign.width() as f32 - 1.0, sign.height() as f32 - 1.0);
    let h = homography(quad, [(0.0, 0.0), (sw, 0.0), (sw, sh), (0.0, sh)]);
    let xs = quad.map(|p| p.0);
    let ys = quad.map(|p| p.1);
    let (min_x, max_x) = (xs.iter().cloned().fold(f32::MAX, f32::min), xs.iter().cloned().fold(f32::MIN, f32::max));
    let (min_y, max_y) = (ys.iter().cloned().fold(f32::MAX, f32::min), ys.iter().cloned().fold(f32::MIN, f32::max));
    for y in min_y.max(0.0) as u32..(max_y as u32).min(bg.height()) {
        for x in min_x.max(0.0) as u32..(max_x as u32).min(bg.width()) {
            let (xf, yf) = (x as f64, y as f64);
            let d = h[6] * xf + h[7] * yf + h[8];
            let u = (h[0] * xf + h[1] * yf + h[2]) / d;
            let v = (h[3] * xf + h[4] * yf + h[5]) / d;
            if let Some(p) = sample(sign, u as f32, v as f32) {
                bg.put_pixel(x, y, Rgb(p.map(clamp_u8)));
            }
        }
    }
}

fn lighting(img: &mut RgbImage, from: f32, to: f32, angle: f32) {
    let (w, h) = (img.width() as f32, img.height() as f32);
    let (c, s) = (angle.cos(), angle.sin());
    let span = w * c.abs() + h * s.abs();
    for (x, y, p) in img.enumerate_pixels_mut() {
        let t = ((x as f32 * c + y as f32 * s) / span).clamp(0.0, 1.0);
        let f = from + (to - from) * t;
        for v in p.0.iter_mut() {
            *v = clamp_u8(*v as f32 * f);
        }
    }
}

fn noise(img: &mut RgbImage, sigma: f32, rng: &mut Rng) {
    for p in img.pixels_mut() {
        for v in p.0.iter_mut() {
            *v = clamp_u8(*v as f32 + sigma * rng.gauss());
        }
    }
}

fn low_contrast(img: &mut RgbImage, lo: f32, hi: f32) {
    for p in img.pixels_mut() {
        for v in p.0.iter_mut() {
            *v = clamp_u8(lo + (hi - lo) * *v as f32 / 255.0);
        }
    }
}

/// 밝기는 그대로 두고 색만 바꾼다: 글자 = 빨강, 바탕 = 청록 (둘 다 휘도 약 125)
fn isoluminant(img: &RgbImage) -> RgbImage {
    let luma: Vec<f32> = img.pixels().map(|p| 0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32).collect();
    let mut hist = [0u32; 256];
    for &l in &luma {
        hist[l as usize] += 1;
    }
    let (t, _) = calar_imgproc::ops::otsu(&hist);
    let (mut dark, mut bright) = ((0f64, 0f64), (0f64, 0f64));
    for &l in &luma {
        if l <= t as f32 { dark = (dark.0 + l as f64, dark.1 + 1.0) } else { bright = (bright.0 + l as f64, bright.1 + 1.0) }
    }
    let (m_dark, m_bright) = ((dark.0 / dark.1) as f32, (bright.0 / bright.1) as f32);
    let text_is_bright = bright.1 < dark.1;
    let fg = [214.0, 92.0, 92.0];
    let bg = [64.0, 148.0, 148.0];
    let mut out = img.clone();
    for (p, &l) in out.pixels_mut().zip(&luma) {
        let w = ((l - m_dark) / (m_bright - m_dark)).clamp(0.0, 1.0);
        let text = if text_is_bright { w } else { 1.0 - w };
        *p = Rgb([0, 1, 2].map(|c| clamp_u8(bg[c] * (1.0 - text) + fg[c] * text)));
    }
    out
}

fn jpeg(img: &RgbImage, quality: u8) -> Vec<u8> {
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, quality).encode_image(img).unwrap();
    out
}

fn png(img: &RgbImage) -> Vec<u8> {
    let mut out = std::io::Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(img.clone()).write_to(&mut out, ImageFormat::Png).unwrap();
    out.into_inner()
}

/// JPEG 맨 앞(SOI 다음)에 리틀엔디언 EXIF(Orientation 태그 하나)를 끼워 넣는다
fn with_exif_orientation(jpeg: &[u8], orientation: u16) -> Vec<u8> {
    let mut tiff = Vec::new();
    tiff.extend_from_slice(b"II\x2a\x00\x08\x00\x00\x00"); // 리틀엔디언 TIFF 헤더, IFD0는 8바이트 뒤
    tiff.extend_from_slice(&1u16.to_le_bytes()); // 항목 1개
    tiff.extend_from_slice(&0x0112u16.to_le_bytes()); // Orientation
    tiff.extend_from_slice(&3u16.to_le_bytes()); // SHORT
    tiff.extend_from_slice(&1u32.to_le_bytes());
    tiff.extend_from_slice(&orientation.to_le_bytes());
    tiff.extend_from_slice(&[0, 0]);
    tiff.extend_from_slice(&0u32.to_le_bytes()); // 다음 IFD 없음
    let mut app1 = b"Exif\0\0".to_vec();
    app1.extend_from_slice(&tiff);

    let mut out = jpeg[..2].to_vec(); // FF D8
    out.extend_from_slice(&[0xFF, 0xE1]);
    out.extend_from_slice(&((app1.len() + 2) as u16).to_be_bytes());
    out.extend_from_slice(&app1);
    out.extend_from_slice(&jpeg[2..]);
    out
}

fn box_blur(img: &RgbImage, radius: u32) -> RgbImage {
    let blur_once = |src: &RgbImage, horizontal: bool| -> RgbImage {
        let (w, h) = src.dimensions();
        RgbImage::from_fn(w, h, |x, y| {
            let mut acc = [0u32; 3];
            let mut n = 0;
            for d in -(radius as i64)..=radius as i64 {
                let (xx, yy) = if horizontal { (x as i64 + d, y as i64) } else { (x as i64, y as i64 + d) };
                if xx >= 0 && yy >= 0 && xx < w as i64 && yy < h as i64 {
                    let p = src.get_pixel(xx as u32, yy as u32);
                    for c in 0..3 {
                        acc[c] += p[c] as u32;
                    }
                    n += 1;
                }
            }
            Rgb(acc.map(|a| (a / n) as u8))
        })
    };
    let mut out = img.clone();
    for _ in 0..2 {
        out = blur_once(&blur_once(&out, true), false);
    }
    out
}

fn make(name: &str, sign: &RgbImage, seed: u64) -> Vec<(String, Vec<u8>)> {
    let mut rng = Rng(seed.wrapping_mul(0x9E3779B97F4A7C15) | 1);
    let (sw, sh) = (sign.width() as f32, sign.height() as f32);
    let mut files = Vec::new();

    // scene: 2000x1500 거리 사진, 간판은 가로 약 70%, 원근 왜곡
    let mut scene = clutter(2000, 1500, &mut rng);
    let (cx, cy, half_w) = (1000.0, 650.0, 700.0);
    let half_h = half_w * sh / sw;
    let j = |rng: &mut Rng| rng.range(-60.0, 60.0);
    let quad = [
        (cx - half_w + j(&mut rng), cy - half_h + j(&mut rng) - 40.0),
        (cx + half_w + j(&mut rng), cy - half_h + j(&mut rng) + 40.0),
        (cx + half_w * 0.92 + j(&mut rng), cy + half_h + j(&mut rng) + 30.0),
        (cx - half_w * 0.95 + j(&mut rng), cy + half_h + j(&mut rng) - 30.0),
    ];
    paste_perspective(&mut scene, sign, quad);
    lighting(&mut scene, 1.1, 0.6, 0.6);
    noise(&mut scene, 6.0, &mut rng);
    files.push((format!("{name}__scene.jpg"), jpeg(&scene, 85)));

    // far: 3000x2250 사진 속 가로 약 30% 크기 간판
    let mut far = clutter(3000, 2250, &mut rng);
    let (fx, fy, fw) = (rng.range(300.0, 1800.0), rng.range(300.0, 1200.0), 900.0);
    let fh = fw * sh / sw;
    paste_perspective(&mut far, sign, [(fx, fy), (fx + fw, fy + 25.0), (fx + fw - 10.0, fy + fh + 20.0), (fx + 5.0, fy + fh)]);
    noise(&mut far, 5.0, &mut rng);
    files.push((format!("{name}__far.jpg"), jpeg(&far, 85)));

    // shadow: 한쪽이 거의 검게 가려지고 전체 대비가 낮음
    let mut shadow = sign.clone();
    low_contrast(&mut shadow, 60.0, 190.0);
    lighting(&mut shadow, 0.25, 1.05, 0.3);
    noise(&mut shadow, 8.0, &mut rng);
    files.push((format!("{name}__shadow.png"), png(&shadow)));

    // blur: 흔들림 + 잡음 + 저화질
    let mut blur = box_blur(sign, 3);
    noise(&mut blur, 14.0, &mut rng);
    files.push((format!("{name}__blur.jpg"), jpeg(&blur, 35)));

    files.push((format!("{name}__isolum.png"), png(&isoluminant(sign))));

    // exif: 시계 반대 방향으로 눕혀 저장 + "시계 방향 90도 돌려서 보여줘"(6)
    let rotated = imageops::rotate270(sign);
    files.push((format!("{name}__exif.jpg"), with_exif_orientation(&jpeg(&rotated, 90), 6)));

    files
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 && args.len() != 4 {
        eprintln!("사용: cargo run --release --example make_hard_fixtures -- <원본 폴더> <출력 폴더> [시드]");
        std::process::exit(2);
    }
    let (src, out) = (Path::new(&args[1]), PathBuf::from(&args[2]));
    let seed: u64 = args.get(3).map_or(0, |s| s.parse().expect("시드는 숫자"));
    fs::create_dir_all(&out).unwrap();
    let mut entries: Vec<_> = fs::read_dir(src).unwrap().map(|e| e.unwrap().path()).collect();
    entries.sort();
    for (i, path) in entries.iter().enumerate() {
        let stem = path.file_stem().unwrap().to_string_lossy().to_string();
        let sign = image::open(path).unwrap().into_rgb8();
        for (file, bytes) in make(&stem, &sign, seed * 1000 + i as u64 + 1) {
            fs::write(out.join(&file), bytes).unwrap();
            println!("{file}");
        }
    }
}
