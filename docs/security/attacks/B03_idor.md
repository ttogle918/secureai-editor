# B03: Broken Access Control / IDOR
OWASP: A01:2021 (1위) | CWE-284, CWE-639 | CVSS: 6.5~9.8 HIGH~CRITICAL

## 취약 패턴
```python
# FastAPI/Flask - 소유권 검증 없음 CRITICAL
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, db=Depends(get_db)):
    return db.query(Order).filter(Order.id == order_id).first()
    # current_user.id와 order.user_id 비교 없음!

@app.put("/api/profiles/{user_id}")
async def update(user_id: int, data: dict, db=Depends(get_db)):
    db.query(User).filter(User.id == user_id).update(data)
    # 누구든 어떤 user_id든 수정 가능
```
```javascript
// Express/NestJS - HIGH
app.get('/api/documents/:id', auth, async (req, res) => {
  const doc = await Document.findById(req.params.id)  // userId 비교 없음
  res.json(doc)
})
// Next.js API Route - 인증 완전 없음 CRITICAL
export default async function handler(req, res) {
  const users = await User.findAll()  // 세션 확인 없음
  res.json(users)
}
```
```java
// Spring - HIGH
@GetMapping("/api/orders/{orderId}")
public Order getOrder(@PathVariable Long orderId, @AuthenticationPrincipal UserDetails user) {
    return orderRepo.findById(orderId).orElseThrow()  // user와 소유권 비교 없음
}
// @PreAuthorize 누락 - HIGH
@DeleteMapping("/admin/users/{id}")
public void deleteUser(@PathVariable Long id) { ... }  // @PreAuthorize 없음
```

## 수정 패턴
```python
# ✅ 소유권 검증 필수 패턴
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user=Depends(get_current_user), db=Depends(get_db)):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id  # 소유권 검증
    ).first()
    if not order:
        raise HTTPException(status_code=404)  # 403 아닌 404 (정보 은닉)
    return order

# ✅ 역할 기반 접근 제어
def require_role(role: str):
    async def checker(current_user=Depends(get_current_user)):
        if current_user.role != role:
            raise HTTPException(status_code=403)
    return checker
```
```javascript
// ✅ Express 소유권 검증
app.get('/api/documents/:id', authenticate, async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id })
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})
```
```java
// ✅ Spring IDOR 방지
return orderRepo.findByIdAndUsername(orderId, user.getUsername())
    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND))
// ✅ 역할 검증
@PreAuthorize("hasRole('ADMIN')")
@DeleteMapping("/admin/users/{id}")
```

## 심각도
- CRITICAL: 소유권 검증 없음 + 수정/삭제 + 민감 데이터
- HIGH: 소유권 검증 없음 + 읽기 / 역할 검증 없는 관리자 기능
- MEDIUM: Mass Assignment (민감 필드 조작 가능 구조)
- LOW: 내부 전용 API에서 소유권 검증 부재
