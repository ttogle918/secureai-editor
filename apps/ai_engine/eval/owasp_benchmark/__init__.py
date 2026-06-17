"""OWASP Benchmark Java 평가 하니스.

이 패키지는 OWASP BenchmarkJava 데이터셋으로 SAST 탐지 정확도를
정량 측정하는 독립 평가 하니스입니다.

사용법:
    make eval LIMIT=N        # vulnType별 N건 샘플 실행
    make eval                # 풀런 (야간/릴리스 게이트용)

DoD:
    - stdout: recall=.. fpr=.. score=..
    - apps/ai_engine/eval/results/latest.json 생성
"""
