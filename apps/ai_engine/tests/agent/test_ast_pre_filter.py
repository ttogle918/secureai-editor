import pytest
from agent.validation.ast_pre_filter import should_skip_llm

# ── Python 테스트 ────────────────────────────────────────────────────────

def test_should_skip_llm_clean_python():
    code = """
def greet(name):
    return f"Hello, {name}!"
"""
    assert should_skip_llm("test.py", code, "python") is True


def test_should_skip_llm_dirty_python():
    code = """
import subprocess

def ping(host):
    subprocess.run(f"ping {host}", shell=True)
"""
    assert should_skip_llm("test.py", code, "python") is False


def test_should_skip_llm_syntax_error_python():
    # 문법 오류 코드는 안전을 위해 LLM으로 통과해야 함 (False 반환)
    code = """
def invalid_syntax(
    eval("oops")
"""
    assert should_skip_llm("test.py", code, "python") is False



# ── Java / Kotlin 테스트 ──────────────────────────────────────────────────

def test_should_skip_llm_clean_java():
    code = """
package io.secureai;

public class UserDto {
    private String name;
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
"""
    assert should_skip_llm("UserDto.java", code, "java") is True


def test_should_skip_llm_dirty_java_sql():
    code = """
package io.secureai;
import java.sql.Connection;

public class UserService {
    public void queryUser(Connection conn, String id) throws Exception {
        String sql = "SELECT * FROM users WHERE id = '" + id + "'";
        conn.createStatement().execute(sql);
    }
}
"""
    assert should_skip_llm("UserService.java", code, "java") is False


def test_should_skip_llm_dirty_java_process():
    code = """
package io.secureai;

public class Util {
    public void runCmd(String cmd) throws Exception {
        new ProcessBuilder(cmd).start();
    }
}
"""
    assert should_skip_llm("Util.java", code, "java") is False


def test_should_skip_llm_clean_kotlin():
    code = """
package io.secureai

data class User(val name: String)
"""
    assert should_skip_llm("User.kt", code, "kotlin") is True


def test_should_skip_llm_dirty_kotlin_shared_pref():
    code = """
package io.secureai
import android.content.Context

class PreferenceManager(context: Context) {
    val pref = context.getSharedPreferences("prefs", Context.MODE_PRIVATE)
}
"""
    assert should_skip_llm("PreferenceManager.kt", code, "kotlin") is False


# ── JS / TS 테스트 ────────────────────────────────────────────────────────

def test_should_skip_llm_clean_javascript():
    code = """
import React from 'react';

export default function Button({ label }) {
    return <button>{label}</button>;
}
"""
    assert should_skip_llm("Button.jsx", code, "javascript") is True


def test_should_skip_llm_dirty_javascript_danger():
    code = """
export default function SafeHtml({ html }) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
"""
    assert should_skip_llm("SafeHtml.jsx", code, "javascript") is False


def test_should_skip_llm_dirty_typescript_eval():
    code = """
function runExpr(expr: string): any {
    return eval(expr);
}
"""
    assert should_skip_llm("eval.ts", code, "typescript") is False
