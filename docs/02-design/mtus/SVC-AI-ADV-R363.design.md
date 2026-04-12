# SVC-AI-ADV-R363 Design

## 알고리즘
- window 내 요청 카운트 → rate = count/windowSec
- rate > threshold → spike=true
- payload에 ['SELECT','<script','UNION','DROP'] 포함 시 malicious=true
- block = spike || malicious
