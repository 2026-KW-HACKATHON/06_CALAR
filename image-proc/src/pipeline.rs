//! 간판 사진 1장 → OCR에 넣을 이미지 3종
//!
//! 1. 디코딩 (JPEG/PNG/WebP) + EXIF 회전 보정
//! 2. 투명 배경은 흰색으로 합성
//! 3. 크기 정규화: 긴 변 1600px 초과면 축소, 1000px 미만이면 확대(최대 3배)
//! 4. 흑백 채널 선택: 휘도 vs 색 주성분(PCA) 중 글자/바탕이 더 잘 나뉘는 쪽 (Otsu 분리도 비교)
//! 5. 명암 늘리기 + 3x3 중간값 필터(점 잡음 제거)
//! 6. 극성 정규화: 글자를 어둡게, 바탕을 밝게 (주변과 비교해 판단 → 그림자에 속지 않음)
//! 7. 조명 평탄화: 바탕 밝기를 추정해 나눠서 그림자·역광으로 생긴 밝기 기울기를 없앤다
//! 8. Sauvola 적응형 이진화 + 작은 점 제거
//!
//! 결과: gray(7단계까지), binary(8단계) — 둘 다 PGM
//! PGM은 압축 없는 단순 포맷이라 인코딩 비용이 거의 없고 tesseract(Leptonica)가 바로 읽는다.

use crate::ops;
use image::metadata::Orientation;
use image::{imageops, DynamicImage, ImageDecoder, ImageError, ImageReader, Limits, RgbImage};
use std::fmt;
use std::io::Cursor;

/// 이보다 크면 축소. 간판 글자 인식에 충분하고 OCR 시간이 사진 크기에 비례해 늘어나는 것을 막는다.
pub const MAX_SIDE: u32 = 1600;
/// 이보다 작으면 확대. tesseract는 글자 높이가 20px 이상일 때 잘 읽는다.
pub const MIN_SIDE: u32 = 1000;
const MAX_UPSCALE: f32 = 3.0;
/// 입력 해상도 상한 (백엔드도 5천만 화소로 막지만 여기서도 한 번 더 막는다)
const MAX_INPUT_SIDE: u32 = 20_000;
const MAX_DECODE_BYTES: u64 = 512 * 1024 * 1024;

/// 명암 늘리기에서 양 끝 0.5%는 잡음(반사광, 그림자 끝)으로 보고 잘라낸다
const STRETCH_LOW: f32 = 0.005;
const STRETCH_HIGH: f32 = 0.995;
/// PCA 채널이 휘도보다 이만큼 이상 잘 나뉠 때만 PCA를 쓴다 (비슷하면 익숙한 휘도 우선)
const PCA_MARGIN: f64 = 0.02;
const SAUVOLA_K: f64 = 0.2;

#[derive(Debug)]
pub enum Error {
    /// 이미지가 아니거나 내용이 깨짐
    Decode(String),
    /// 해상도나 메모리 상한 초과
    TooLarge,
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Decode(msg) => write!(f, "decode failed: {msg}"),
            Error::TooLarge => write!(f, "image too large"),
        }
    }
}

impl std::error::Error for Error {}

impl From<ImageError> for Error {
    fn from(err: ImageError) -> Self {
        match err {
            ImageError::Limits(_) => Error::TooLarge,
            other => Error::Decode(other.to_string()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Luma,
    Pca,
}

impl Channel {
    pub fn as_str(self) -> &'static str {
        match self {
            Channel::Luma => "luma",
            Channel::Pca => "pca",
        }
    }
}

#[derive(Debug)]
pub struct Processed {
    pub width: u32,
    pub height: u32,
    /// 적용한 EXIF 방향 값 (1 = 회전 없음, 6 = 시계방향 90도 등)
    pub orientation: u8,
    pub channel: Channel,
    /// 밝은 글자/어두운 바탕이라 반전했는지
    pub inverted: bool,
    pub gray: Vec<u8>,
    pub binary: Vec<u8>,
}

impl Processed {
    /// 백엔드 로그·테스트용 요약 (JSON)
    pub fn info_json(&self) -> String {
        format!(
            "{{\"width\":{},\"height\":{},\"orientation\":{},\"channel\":\"{}\",\"inverted\":{}}}",
            self.width,
            self.height,
            self.orientation,
            self.channel.as_str(),
            self.inverted
        )
    }
}

pub fn preprocess(bytes: &[u8]) -> Result<Processed, Error> {
    let (image, orientation) = decode(bytes)?;
    let rgb = normalize_size(flatten_alpha(image));
    let (width, height) = rgb.dimensions();
    let (w, h) = (width as usize, height as usize);

    let radius = (w.min(h) / 12).clamp(7, 50);

    let (selected, channel) = select_gray(rgb.as_raw());
    let mut gray = ops::median3(&selected, w, h);
    let inverted = ops::text_is_bright(&gray, w, h, radius);
    if inverted {
        gray.iter_mut().for_each(|v| *v = 255 - *v);
    }
    let gray = flatten_background(&gray, w, h);
    let mut binary = ops::sauvola(&gray, w, h, radius, SAUVOLA_K);
    // 점 잡음 기준: 1200x400 사진에서 12픽셀, 1600x1200에서 48픽셀 미만 덩어리
    ops::despeckle(&mut binary, w, h, (w * h / 40_000).max(8));

    Ok(Processed {
        width,
        height,
        orientation,
        channel,
        inverted,
        gray: pgm(width, height, &gray),
        binary: pgm(width, height, &binary),
    })
}

fn decode(bytes: &[u8]) -> Result<(DynamicImage, u8), Error> {
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| Error::Decode(e.to_string()))?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_INPUT_SIDE);
    limits.max_image_height = Some(MAX_INPUT_SIDE);
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    reader.limits(limits);

    let mut decoder = reader.into_decoder()?;
    // 휴대폰 사진은 픽셀은 눕혀 저장하고 EXIF에 "돌려서 보여줘"만 적는 경우가 많다
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    Ok((image, orientation.to_exif()))
}

fn flatten_alpha(image: DynamicImage) -> RgbImage {
    if !image.color().has_alpha() {
        return image.into_rgb8();
    }
    let rgba = image.into_rgba8();
    let mut out = RgbImage::new(rgba.width(), rgba.height());
    for (src, dst) in rgba.pixels().zip(out.pixels_mut()) {
        let a = src[3] as u32;
        for c in 0..3 {
            dst[c] = ((src[c] as u32 * a + 255 * (255 - a) + 127) / 255) as u8;
        }
    }
    out
}

fn normalize_size(rgb: RgbImage) -> RgbImage {
    let (w, h) = rgb.dimensions();
    let long = w.max(h);
    let scaled = |s: f32| (((w as f32 * s).round() as u32).max(1), ((h as f32 * s).round() as u32).max(1));
    if long > MAX_SIDE {
        let (nw, nh) = scaled(MAX_SIDE as f32 / long as f32);
        imageops::thumbnail(&rgb, nw, nh) // 축소 전용 면적 평균: 빠르고 계단 현상이 없다
    } else if long < MIN_SIDE {
        let (nw, nh) = scaled((MIN_SIDE as f32 / long as f32).min(MAX_UPSCALE));
        imageops::resize(&rgb, nw, nh, imageops::FilterType::CatmullRom)
    } else {
        rgb
    }
}

fn select_gray(rgb: &[u8]) -> (Vec<u8>, Channel) {
    let luma = ops::stretch(&ops::luma(rgb), STRETCH_LOW, STRETCH_HIGH);
    let (_, eta_luma) = ops::otsu(&ops::histogram(&luma));
    let pca = ops::stretch(&ops::project(rgb, ops::principal_axis(rgb)), STRETCH_LOW, STRETCH_HIGH);
    let (_, eta_pca) = ops::otsu(&ops::histogram(&pca));
    if eta_pca > eta_luma + PCA_MARGIN {
        (pca, Channel::Pca)
    } else {
        (luma, Channel::Luma)
    }
}

/// 조명 평탄화: 글자 획보다 넓은 창의 최댓값(= 글자를 지운 바탕 밝기)을 흐리게 펴서 원래 값을 나눈다.
/// 바탕은 고르게 밝아지고 글자는 바탕 대비 비율로 남아서, 한쪽이 그늘진 간판도 같은 밝기 차이가 된다.
fn flatten_background(gray: &[u8], w: usize, h: usize) -> Vec<u8> {
    let r = (w.min(h) / 30).clamp(6, 40);
    let background = ops::box_blur(&ops::max_filter(gray, w, h, r), w, h, r);
    let ratio: Vec<f32> = gray
        .iter()
        .zip(&background)
        .map(|(&v, &b)| v as f32 / b.max(1) as f32)
        .collect();
    ops::stretch(&ratio, STRETCH_LOW, STRETCH_HIGH)
}

fn pgm(width: u32, height: u32, pixels: &[u8]) -> Vec<u8> {
    let header = format!("P5 {width} {height} 255\n");
    let mut out = Vec::with_capacity(header.len() + pixels.len());
    out.extend_from_slice(header.as_bytes());
    out.extend_from_slice(pixels);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, Rgb, RgbaImage};

    fn encode(image: &DynamicImage, format: ImageFormat) -> Vec<u8> {
        let mut out = Cursor::new(Vec::new());
        image.write_to(&mut out, format).unwrap();
        out.into_inner()
    }

    /// 흰 글자(가운데 막대) + 짙은 바탕
    fn sign(w: u32, h: u32) -> RgbImage {
        RgbImage::from_fn(w, h, |x, y| {
            let text = y > h / 3 && y < h * 2 / 3 && (x / 20) % 2 == 0;
            if text { Rgb([250, 250, 250]) } else { Rgb([120, 20, 20]) }
        })
    }

    fn header(pnm: &[u8]) -> String {
        let end = pnm.iter().position(|&b| b == b'\n').unwrap();
        String::from_utf8(pnm[..end].to_vec()).unwrap()
    }

    #[test]
    fn decodes_png_jpeg_webp_and_returns_gray_and_binary() {
        let img = DynamicImage::ImageRgb8(sign(1200, 400));
        for format in [ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP] {
            let out = preprocess(&encode(&img, format)).unwrap();
            assert_eq!((out.width, out.height), (1200, 400), "{format:?}");
            assert_eq!(header(&out.gray), "P5 1200 400 255");
            assert_eq!(out.binary.len(), out.gray.len());
        }
    }

    #[test]
    fn bright_text_on_dark_background_is_inverted() {
        let out = preprocess(&encode(&DynamicImage::ImageRgb8(sign(1200, 400)), ImageFormat::Png)).unwrap();
        assert!(out.inverted);
        let px = |x: usize, y: usize| out.gray[out.gray.len() - 1200 * 400 + y * 1200 + x];
        assert!(px(10, 200) < 60, "글자는 어둡게");
        assert!(px(30, 200) > 200, "바탕은 밝게");
    }

    #[test]
    fn resizes_large_and_small_images() {
        let big = preprocess(&encode(&DynamicImage::ImageRgb8(sign(4000, 3000)), ImageFormat::Jpeg)).unwrap();
        assert_eq!((big.width, big.height), (1600, 1200));
        let small = preprocess(&encode(&DynamicImage::ImageRgb8(sign(300, 100)), ImageFormat::Png)).unwrap();
        assert_eq!((small.width, small.height), (900, 300)); // 3배 상한
    }

    #[test]
    fn transparent_background_becomes_white() {
        // 투명 바탕 + 불투명 검은 글자 막대 → 흰 바탕의 검은 글자
        let img = RgbaImage::from_fn(1200, 400, |x, y| {
            let text = y > 150 && y < 250 && (x / 20) % 2 == 0;
            if text { image::Rgba([0, 0, 0, 255]) } else { image::Rgba([0, 0, 0, 0]) }
        });
        let out = preprocess(&encode(&DynamicImage::ImageRgba8(img), ImageFormat::Png)).unwrap();
        assert!(!out.inverted);
        let px = |x: usize, y: usize| out.gray[out.gray.len() - 1200 * 400 + y * 1200 + x];
        assert!(px(10, 200) < 60, "글자");
        assert!(px(30, 200) > 200, "바탕");
        assert!(px(10, 50) > 200, "투명했던 곳");
    }

    #[test]
    fn rejects_broken_and_non_image_input() {
        assert!(matches!(preprocess(b"hello"), Err(Error::Decode(_))));
        let mut png = encode(&DynamicImage::ImageRgb8(sign(100, 100)), ImageFormat::Png);
        png.truncate(60);
        assert!(preprocess(&png).is_err());
    }
}
