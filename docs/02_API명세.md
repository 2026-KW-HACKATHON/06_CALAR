프론트의 핵심 컴포넌트를 기반으로 API명세를 작성하려고 한다.

## /home

home에는 간판 찍기 버튼, 추천 음식들이 있다.   
요청 예시   
```
GET /home
```
추천 음식을 받아오는 API만 만들면 될 것 같다.   
요청 예시
```
POST /api {p: 0}
```
p는 purpose의 약어이다.   
응답 예시   
```
200 {
foods: [{
  food_name,
  food_img,
  food_cost,
  food_rate
}, ...]}
```   
```
500
```   
위의 경우(500)는 서버에서 에러가 발생한 경우이다.   

## /pannel

pannel에는 사진을 찍어서 올려서 무슨 가게인지 맞추고 가게를 소개하는 /store 페이지로 넘어가도록 한다.   
요청 예시
```
GET /pannel
POST /api {p: 1, d: "data:image/jpeg;base64,/9j/4QFKRXhpZgAATU0AKgAAAAgABQEAAAMAAAABBDgAAAEBAAMAAAABCSQAAAExAAIAAAA..."}
```
응답 예시
```
200 {d: "https://wolgye.kr/

