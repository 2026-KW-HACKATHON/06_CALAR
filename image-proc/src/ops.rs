//! 픽셀 단위 영상 처리 함수 모음 (외부 라이브러리 없이 직접 구현)
//!
//! 모든 함수는 행 우선(row-major) 1차원 버퍼를 다룬다. index = y * width + x

/// RGB 이미지를 BT.601 휘도(밝기)로 변환한다. 일반적인 흑백 변환과 같다.
pub fn luma(rgb: &[u8]) -> Vec<f32> {
    rgb.chunks_exact(3)
        .map(|p| 0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32)
        .collect()
}

/// 색 분포가 가장 크게 퍼진 방향(주성분, PCA 1번 축)을 구한다.
///
/// 간판은 "글자색 vs 바탕색" 두 색이 대부분이라 두 색을 잇는 방향으로 분산이 가장 크다.
/// 빨강 바탕에 초록 글씨처럼 밝기는 비슷하고 색만 다른 간판도 이 축으로 투영하면 글자가 또렷해진다.
/// 색이 거의 없으면(흑백 사진 등) 휘도 가중치를 그대로 돌려준다.
pub fn principal_axis(rgb: &[u8]) -> [f32; 3] {
    const LUMA: [f32; 3] = [0.299, 0.587, 0.114];
    let n = rgb.len() / 3;
    if n == 0 {
        return LUMA;
    }
    // 큰 사진은 일부 픽셀만 표본으로 써도 축 방향은 거의 같다
    let step = (n / 200_000).max(1);

    let mut sum = [0f64; 3];
    let mut count = 0f64;
    for p in rgb.chunks_exact(3).step_by(step) {
        for c in 0..3 {
            sum[c] += p[c] as f64;
        }
        count += 1.0;
    }
    let mean = sum.map(|s| s / count);

    let mut cov = [[0f64; 3]; 3];
    for p in rgb.chunks_exact(3).step_by(step) {
        let d = [p[0] as f64 - mean[0], p[1] as f64 - mean[1], p[2] as f64 - mean[2]];
        for i in 0..3 {
            for j in 0..3 {
                cov[i][j] += d[i] * d[j];
            }
        }
    }
    for row in cov.iter_mut() {
        for v in row.iter_mut() {
            *v /= count;
        }
    }
    let trace = cov[0][0] + cov[1][1] + cov[2][2];
    if trace < 1.0 {
        return LUMA; // 사실상 단색 이미지
    }

    // 거듭제곱법(power iteration): 3x3 대칭 행렬이라 몇십 번이면 수렴한다
    let mut v = [1.0f64, 1.0, 1.0];
    for _ in 0..64 {
        let next = [
            cov[0][0] * v[0] + cov[0][1] * v[1] + cov[0][2] * v[2],
            cov[1][0] * v[0] + cov[1][1] * v[1] + cov[1][2] * v[2],
            cov[2][0] * v[0] + cov[2][1] * v[1] + cov[2][2] * v[2],
        ];
        let norm = (next[0] * next[0] + next[1] * next[1] + next[2] * next[2]).sqrt();
        if norm < 1e-12 {
            return LUMA;
        }
        v = next.map(|x| x / norm);
    }
    // 부호는 "밝을수록 큰 값"이 되도록 맞춘다 (극성은 나중에 따로 정규화하지만 디버깅이 쉬워진다)
    if v[0] + v[1] + v[2] < 0.0 {
        v = v.map(|x| -x);
    }
    v.map(|x| x as f32)
}

/// RGB를 주어진 축으로 투영한 값(실수)을 돌려준다.
pub fn project(rgb: &[u8], axis: [f32; 3]) -> Vec<f32> {
    rgb.chunks_exact(3)
        .map(|p| axis[0] * p[0] as f32 + axis[1] * p[1] as f32 + axis[2] * p[2] as f32)
        .collect()
}

/// 하위 low, 상위 high 비율 지점을 0과 255로 펼친다 (명암 늘리기).
/// 흐린 날·역광처럼 대비가 낮은 사진에서 글자와 바탕의 차이를 키운다.
pub fn stretch(values: &[f32], low: f32, high: f32) -> Vec<u8> {
    if values.is_empty() {
        return Vec::new();
    }
    let (mut min, mut max) = (f32::MAX, f32::MIN);
    for &v in values {
        min = min.min(v);
        max = max.max(v);
    }
    if max - min < 1e-3 {
        return vec![255; values.len()]; // 단색: 글자가 없다
    }

    const BINS: usize = 4096;
    let scale = (BINS - 1) as f32 / (max - min);
    let mut hist = vec![0u32; BINS];
    for &v in values {
        hist[((v - min) * scale) as usize] += 1;
    }
    let n = values.len() as f32;
    let percentile = |fraction: f32| -> f32 {
        let target = (fraction * n) as u64;
        let mut acc = 0u64;
        for (i, &h) in hist.iter().enumerate() {
            acc += h as u64;
            if acc > target {
                return min + i as f32 / scale;
            }
        }
        max
    };
    let lo = percentile(low);
    let hi = percentile(high).max(lo + 1e-3);
    let k = 255.0 / (hi - lo);
    values
        .iter()
        .map(|&v| ((v - lo) * k).clamp(0.0, 255.0).round() as u8)
        .collect()
}

pub fn histogram(gray: &[u8]) -> [u32; 256] {
    let mut hist = [0u32; 256];
    for &v in gray {
        hist[v as usize] += 1;
    }
    hist
}

/// Otsu 임계값과 분리도(η = 클래스 간 분산 / 전체 분산, 0~1)를 구한다.
/// η가 1에 가까울수록 "두 색으로 깔끔하게 나뉘는" 영상이다 → 채널 선택 기준으로 쓴다.
pub fn otsu(hist: &[u32; 256]) -> (u8, f64) {
    let total: f64 = hist.iter().map(|&h| h as f64).sum();
    if total == 0.0 {
        return (127, 0.0);
    }
    let sum_all: f64 = hist.iter().enumerate().map(|(i, &h)| i as f64 * h as f64).sum();
    let mean = sum_all / total;
    let var_total: f64 = hist
        .iter()
        .enumerate()
        .map(|(i, &h)| (i as f64 - mean).powi(2) * h as f64)
        .sum::<f64>()
        / total;

    let (mut best_t, mut best_between) = (127u8, 0f64);
    let (mut w0, mut sum0) = (0f64, 0f64);
    for (t, &count) in hist.iter().enumerate().take(255) {
        w0 += count as f64;
        sum0 += t as f64 * count as f64;
        let w1 = total - w0;
        if w0 == 0.0 || w1 == 0.0 {
            continue;
        }
        let m0 = sum0 / w0;
        let m1 = (sum_all - sum0) / w1;
        let between = w0 * w1 * (m0 - m1).powi(2) / (total * total);
        if between > best_between {
            best_between = between;
            best_t = t as u8;
        }
    }
    let eta = if var_total > 0.0 { best_between / var_total } else { 0.0 };
    (best_t, eta)
}

/// Sauvola 지역 적응형 이진화. 글자(어두운 쪽)는 0, 바탕은 255.
///
/// 그림자·조명 차이로 한 사진 안에서 밝기가 달라도 주변(window) 평균과 표준편차로
/// 임계값을 정하므로 글자가 지워지지 않는다. 적분 영상으로 픽셀당 O(1)에 계산한다.
/// T = m * (1 + k * (s / 128 - 1))
pub fn sauvola(gray: &[u8], width: usize, height: usize, radius: usize, k: f64) -> Vec<u8> {
    let stride = width + 1;
    let mut sum = vec![0u64; stride * (height + 1)];
    let mut sq = vec![0u64; stride * (height + 1)];
    for y in 0..height {
        let (mut row_sum, mut row_sq) = (0u64, 0u64);
        for x in 0..width {
            let v = gray[y * width + x] as u64;
            row_sum += v;
            row_sq += v * v;
            sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + row_sum;
            sq[(y + 1) * stride + x + 1] = sq[y * stride + x + 1] + row_sq;
        }
    }

    let mut out = vec![255u8; width * height];
    for y in 0..height {
        let y0 = y.saturating_sub(radius);
        let y1 = (y + radius + 1).min(height);
        for x in 0..width {
            let x0 = x.saturating_sub(radius);
            let x1 = (x + radius + 1).min(width);
            let area = ((y1 - y0) * (x1 - x0)) as f64;
            let rect = |t: &[u64]| -> f64 {
                (t[y1 * stride + x1] + t[y0 * stride + x0] - t[y0 * stride + x1] - t[y1 * stride + x0]) as f64
            };
            let m = rect(&sum) / area;
            let var = (rect(&sq) / area - m * m).max(0.0);
            let threshold = m * (1.0 + k * (var.sqrt() / 128.0 - 1.0));
            if (gray[y * width + x] as f64) <= threshold {
                out[y * width + x] = 0;
            }
        }
    }
    out
}

/// 3x3 중간값 필터. 점 잡음(센서 노이즈, JPEG 블록)은 지우고 글자 가장자리는 유지한다.
pub fn median3(gray: &[u8], width: usize, height: usize) -> Vec<u8> {
    let mut out = gray.to_vec();
    if width < 3 || height < 3 {
        return out;
    }
    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let mut v = [0u8; 9];
            let mut i = 0;
            for dy in 0..3 {
                let row = (y + dy - 1) * width + x - 1;
                v[i..i + 3].copy_from_slice(&gray[row..row + 3]);
                i += 3;
            }
            v.sort_unstable();
            out[y * width + x] = v[4];
        }
    }
    out
}

/// 가로·세로 반경 radius 안의 최댓값 (밝은 바탕을 글자 위로 번지게 해서 "글자 없는 바탕"을 추정)
pub fn max_filter(gray: &[u8], width: usize, height: usize, radius: usize) -> Vec<u8> {
    let pass = |src: &[u8], len: usize, count: usize, at: &dyn Fn(usize, usize) -> usize| -> Vec<u8> {
        let mut out = vec![0u8; src.len()];
        let mut deque: std::collections::VecDeque<usize> = std::collections::VecDeque::with_capacity(2 * radius + 2);
        for line in 0..count {
            deque.clear();
            // 단조 감소 덱: 창 안 최댓값을 O(1)로 유지
            for i in 0..len + radius {
                if i < len {
                    let v = src[at(line, i)];
                    while deque.back().is_some_and(|&j| src[at(line, j)] <= v) {
                        deque.pop_back();
                    }
                    deque.push_back(i);
                }
                if i >= radius {
                    let center = i - radius;
                    while deque.front().is_some_and(|&j| j + radius < center) {
                        deque.pop_front();
                    }
                    out[at(line, center)] = src[at(line, *deque.front().unwrap())];
                }
            }
        }
        out
    };
    let horizontal = pass(gray, width, height, &|line, i| line * width + i);
    pass(&horizontal, height, width, &|line, i| i * width + line)
}

/// 반경 radius 박스 평균 (적분 영상)
pub fn box_blur(gray: &[u8], width: usize, height: usize, radius: usize) -> Vec<u8> {
    let stride = width + 1;
    let mut sum = vec![0u64; stride * (height + 1)];
    for y in 0..height {
        let mut row = 0u64;
        for x in 0..width {
            row += gray[y * width + x] as u64;
            sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + row;
        }
    }
    let mut out = vec![0u8; width * height];
    for y in 0..height {
        let (y0, y1) = (y.saturating_sub(radius), (y + radius + 1).min(height));
        for x in 0..width {
            let (x0, x1) = (x.saturating_sub(radius), (x + radius + 1).min(width));
            let total = sum[y1 * stride + x1] + sum[y0 * stride + x0] - sum[y0 * stride + x1] - sum[y1 * stride + x0];
            out[y * width + x] = (total / ((y1 - y0) * (x1 - x0)) as u64) as u8;
        }
    }
    out
}

/// 글자가 주변보다 밝은지(밝은 글자/어두운 바탕) 판단한다.
///
/// 글자 획은 주변 창 안에서 소수라서 평균에서 크게(표준편차 이상) 벗어난다. 밝은 쪽으로 크게 벗어난
/// 픽셀과 어두운 쪽으로 크게 벗어난 픽셀 수를 비교한다. 사진 전체 밝기 분포로 판단하면 그림자·조명
/// 기울기에 속지만 주변과 비교하면 속지 않는다.
pub fn text_is_bright(gray: &[u8], width: usize, height: usize, radius: usize) -> bool {
    let stride = width + 1;
    let mut sum = vec![0u64; stride * (height + 1)];
    let mut sq = vec![0u64; stride * (height + 1)];
    for y in 0..height {
        let (mut row, mut row_sq) = (0u64, 0u64);
        for x in 0..width {
            let v = gray[y * width + x] as u64;
            row += v;
            row_sq += v * v;
            sum[(y + 1) * stride + x + 1] = sum[y * stride + x + 1] + row;
            sq[(y + 1) * stride + x + 1] = sq[y * stride + x + 1] + row_sq;
        }
    }
    const NOISE_FLOOR: f64 = 12.0; // 이보다 고른 곳(바탕, 하늘)은 판단에서 뺀다
    let (mut bright, mut dark) = (0u64, 0u64);
    for y in (0..height).step_by(2) {
        let (y0, y1) = (y.saturating_sub(radius), (y + radius + 1).min(height));
        for x in (0..width).step_by(2) {
            let (x0, x1) = (x.saturating_sub(radius), (x + radius + 1).min(width));
            let area = ((y1 - y0) * (x1 - x0)) as f64;
            let rect = |t: &[u64]| (t[y1 * stride + x1] + t[y0 * stride + x0] - t[y0 * stride + x1] - t[y1 * stride + x0]) as f64;
            let m = rect(&sum) / area;
            let s = (rect(&sq) / area - m * m).max(0.0).sqrt();
            if s < NOISE_FLOOR {
                continue;
            }
            let d = gray[y * width + x] as f64 - m;
            if d > s {
                bright += 1;
            } else if d < -s {
                dark += 1;
            }
        }
    }
    bright > dark
}

/// 이진 영상(글자 0)에서 min_area 픽셀보다 작은 검은 점 덩어리를 지운다.
/// 남은 잡음 점은 OCR이 글자로 읽으려다 시간을 크게 쓰고 엉뚱한 글자를 만든다.
pub fn despeckle(binary: &mut [u8], width: usize, height: usize, min_area: usize) {
    let mut seen = vec![false; binary.len()];
    let mut stack = Vec::new();
    let mut component = Vec::new();
    for start in 0..binary.len() {
        if binary[start] != 0 || seen[start] {
            continue;
        }
        component.clear();
        stack.push(start);
        seen[start] = true;
        while let Some(i) = stack.pop() {
            component.push(i);
            let (x, y) = (i % width, i / width);
            let mut visit = |j: usize| {
                if binary[j] == 0 && !seen[j] {
                    seen[j] = true;
                    stack.push(j);
                }
            };
            if x > 0 { visit(i - 1); }
            if x + 1 < width { visit(i + 1); }
            if y > 0 { visit(i - width); }
            if y + 1 < height { visit(i + width); }
        }
        if component.len() < min_area {
            for &i in &component {
                binary[i] = 255;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn otsu_splits_two_levels() {
        let mut gray = vec![40u8; 600];
        gray.extend(vec![200u8; 400]);
        let (t, eta) = otsu(&histogram(&gray));
        assert!((40..200).contains(&t), "threshold {t}");
        assert!(eta > 0.99, "eta {eta}");
    }

    #[test]
    fn otsu_on_flat_image_has_zero_separability() {
        let (_, eta) = otsu(&histogram(&[128u8; 100]));
        assert_eq!(eta, 0.0);
    }

    #[test]
    fn principal_axis_finds_isoluminant_color_difference() {
        // 밝기가 거의 같은 빨강/청록: 휘도로는 구분이 안 되지만 주성분 축으로는 크게 벌어진다
        let red = [214u8, 92, 92];
        let teal = [64u8, 148, 148];
        let mut rgb = Vec::new();
        for i in 0..1000 {
            rgb.extend_from_slice(if i % 4 == 0 { &red } else { &teal });
        }
        let l = luma(&rgb);
        let luma_gap = (l[0] - l[1]).abs();
        let axis = principal_axis(&rgb);
        let p = project(&rgb, axis);
        let pca_gap = (p[0] - p[1]).abs();
        assert!(luma_gap < 10.0, "luma gap {luma_gap}");
        assert!(pca_gap > 100.0, "pca gap {pca_gap}");
    }

    #[test]
    fn principal_axis_of_gray_image_is_luma_like() {
        let rgb: Vec<u8> = (0..300).flat_map(|i| [(i % 256) as u8; 3]).collect();
        let axis = principal_axis(&rgb);
        for c in axis {
            assert!((c - 0.577).abs() < 0.01, "{axis:?}");
        }
    }

    #[test]
    fn stretch_expands_low_contrast() {
        let values: Vec<f32> = (0..1000).map(|i| 100.0 + (i % 20) as f32).collect();
        let out = stretch(&values, 0.0, 1.0);
        assert_eq!(*out.iter().min().unwrap(), 0);
        assert_eq!(*out.iter().max().unwrap(), 255);
        assert_eq!(stretch(&[5.0; 10], 0.01, 0.99), vec![255; 10]);
    }

    #[test]
    fn sauvola_keeps_text_under_uneven_lighting() {
        // 왼쪽은 어둡고 오른쪽은 밝은 바탕 위에 같은 대비의 "글자" 줄 두 개
        let (w, h) = (200usize, 60usize);
        let mut gray = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                let background = 60.0 + 180.0 * x as f64 / w as f64;
                let is_text = (25..35).contains(&y) && (x % 20) < 6;
                gray[y * w + x] = if is_text { (background * 0.4) as u8 } else { background as u8 };
            }
        }
        let bin = sauvola(&gray, w, h, 15, 0.2);
        // 어두운 쪽 글자와 밝은 쪽 글자 모두 검정(0), 같은 x의 바탕은 흰색(255)
        assert_eq!(bin[30 * w + 22], 0);
        assert_eq!(bin[30 * w + 182], 0);
        assert_eq!(bin[10 * w + 22], 255);
        assert_eq!(bin[10 * w + 182], 255);
    }

    #[test]
    fn median_removes_salt_noise() {
        let mut gray = vec![100u8; 25];
        gray[12] = 255;
        assert_eq!(median3(&gray, 5, 5)[12], 100);
    }

    #[test]
    fn max_filter_spreads_bright_values() {
        let mut gray = vec![0u8; 49];
        gray[24] = 200; // 7x7 가운데
        let out = max_filter(&gray, 7, 7, 1);
        assert_eq!(out[24 - 7 - 1], 200);
        assert_eq!(out[24 + 7 + 1], 200);
        assert_eq!(out[0], 0);
    }

    #[test]
    fn polarity_survives_strong_lighting_gradient() {
        // 어두운 글자(바탕의 40%) + 왼쪽 밝고 오른쪽 아주 어두운 조명: 전체 분포로는 어두운 픽셀이 다수
        let (w, h) = (300usize, 80usize);
        let mut gray = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                let light = 230.0 * (1.0 - 0.85 * x as f64 / w as f64);
                let text = (30..50).contains(&y) && (x % 16) < 5;
                gray[y * w + x] = (if text { light * 0.4 } else { light }) as u8;
            }
        }
        assert!(!text_is_bright(&gray, w, h, 10));
        let inverted: Vec<u8> = gray.iter().map(|v| 255 - v).collect();
        assert!(text_is_bright(&inverted, w, h, 10));
    }

    #[test]
    fn despeckle_keeps_strokes_and_removes_dots() {
        let (w, h) = (20usize, 10usize);
        let mut bin = vec![255u8; w * h];
        bin[2 * w + 2] = 0; // 점 하나
        for x in 5..15 {
            bin[5 * w + x] = 0; // 획 (10픽셀)
        }
        despeckle(&mut bin, w, h, 4);
        assert_eq!(bin[2 * w + 2], 255);
        assert_eq!(bin[5 * w + 10], 0);
    }
}
