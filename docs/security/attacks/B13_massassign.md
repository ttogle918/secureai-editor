# B13: Mass Assignment / Parameter Pollution
OWASP: A03:2021 (API3) | CWE-915 | CVSS: 6.5~9.1 HIGH

## 취약 패턴
```python
# CRITICAL — dict로 모델 직접 업데이트
@app.put("/api/users/{id}")
async def update(id: int, data: dict, db=Depends(get_db)):
    db.query(User).filter(User.id == id).update(data)
    # data = {"is_admin": True, "role": "superadmin"} 가능

# CRITICAL — request.json() 직접 ORM에
data = await request.json()
for key, value in data.items():
    setattr(user, key, value)           # 모든 필드 덮어쓰기

# HIGH — Pydantic 모델에 민감 필드 포함
class UserUpdate(BaseModel):
    username: str
    is_admin: bool   # 클라이언트 직접 제어 가능
    role: str        # 클라이언트 직접 제어 가능

# HIGH — extra='allow' 설정
class Schema(BaseModel):
    model_config = ConfigDict(extra='allow')  # 추가 필드 허용
```
```javascript
// CRITICAL
await User.findByIdAndUpdate(req.params.id, req.body)  // req.body 그대로
```
```java
// CRITICAL
@PutMapping("/users/{id}")
public User update(@PathVariable Long id, @RequestBody User user) {
    return userRepo.save(user)  // Entity 직접 → isAdmin 조작 가능
}
```

## 수정 패턴
```python
# ✅ Pydantic — 허용 필드만 명시 + extra='forbid'
class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')  # 추가 필드 거부
    username: str = Field(min_length=2, max_length=50)
    email: EmailStr
    bio: str = Field(default="", max_length=500)
    # is_admin, role, balance 없음

@app.put("/api/users/me")
async def update(data: UserUpdateRequest, current_user=Depends(get_current_user)):
    current_user.username = data.username   # 명시적 필드만
    current_user.email = data.email
```
```java
// ✅ DTO 사용
public record UserUpdateRequest(
    @NotBlank @Size(max=50) String username,
    @Email String email
    // isAdmin, role 없음
) {}
// ✅ NestJS ValidationPipe whitelist:true (DTO 없는 필드 자동 제거)
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
```

## 심각도
- CRITICAL: dict 그대로 ORM + is_admin/role 필드 존재
- HIGH: Pydantic에 민감 필드 포함 / extra='allow'
- MEDIUM: exclude 방식(블랙리스트) — 필드 추가 시 누락 위험
