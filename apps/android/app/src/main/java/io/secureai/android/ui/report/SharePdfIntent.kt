package io.secureai.android.ui.report

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

/**
 * PDF 파일을 외부 앱과 공유하는 유틸리티 오브젝트.
 *
 * 설계 원칙:
 * - SRP: PDF 공유 Intent 생성만 담당
 *
 * 보안 규칙:
 * - FileProvider 경유 — file:// URI 직접 사용 금지
 * - 허용된 디렉토리(filesDir) 외 경로 차단 — Path Traversal 방어
 * - FLAG_GRANT_READ_URI_PERMISSION으로 읽기 권한 위임 (쓰기 권한 미부여)
 */
object SharePdfIntent {

    /**
     * 주어진 PDF 파일을 외부 앱에 공유한다.
     *
     * @param context  Context (Activity 또는 Fragment의 context 권장)
     * @param pdfFile  공유할 PDF 파일 (context.filesDir 하위에 있어야 함)
     * @throws IllegalArgumentException pdfFile이 허용 디렉토리 외부에 있을 경우
     */
    fun share(context: Context, pdfFile: File) {
        validatePath(context, pdfFile)

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            pdfFile
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        context.startActivity(Intent.createChooser(intent, "PDF 공유"))
    }

    /**
     * 파일 경로가 허용된 디렉토리(filesDir) 내에 있는지 검증한다.
     * 심볼릭 링크를 포함한 실제 경로(canonical path)를 사용하여 Path Traversal을 방어한다.
     */
    private fun validatePath(context: Context, file: File) {
        val allowedDir = context.filesDir.canonicalFile
        val canonical = file.canonicalFile
        require(canonical.path.startsWith(allowedDir.path + File.separator) ||
                canonical.path == allowedDir.path) {
            "허용되지 않은 파일 경로: filesDir 외부 접근 차단"
        }
    }
}
