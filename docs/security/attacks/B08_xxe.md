# B08: XML External Entity (XXE)
OWASP: A05:2021 | CWE-611 | CVSS: 7.5~9.8 HIGH~CRITICAL

## 취약 패턴
```python
# CRITICAL — defusedxml 미사용
import xml.etree.ElementTree as ET
ET.parse(user_xml_file); ET.fromstring(user_xml_string)
from lxml import etree
etree.XMLParser()                    # 기본값 = 외부 엔티티 허용
etree.fromstring(xml_content)        # resolve_entities 기본 True
```
```java
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance()
// 외부 엔티티 비활성화 없음 → CRITICAL
DocumentBuilder db = dbf.newDocumentBuilder()
db.parse(userXmlInput)
```

## 공격 페이로드
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<data><value>&xxe;</value></data>
```

## 수정 패턴
```python
# ✅ defusedxml 사용
import defusedxml.ElementTree as ET
ET.fromstring(user_xml_string)   # 자동 차단

# ✅ lxml 안전 설정
from lxml import etree
parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
root = etree.fromstring(xml_content, parser)
```
```java
// ✅
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
```

## 심각도
- CRITICAL: 외부 엔티티 허용 + 파일 읽기 가능
- HIGH: DTD 허용 + Billion Laughs DoS
