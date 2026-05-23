package io.secureai.android.data.remote.model

data class DashboardResponse(
    val securityScore: Int,
    val severityCounts: SeverityCounts,
    val trend: List<TrendPoint>,
    val fileHeatmap: List<FileHeatPoint>,
    val owaspCoverage: Map<String, Boolean>
)

data class SeverityCounts(
    val CRITICAL: Int,
    val HIGH: Int,
    val MEDIUM: Int,
    val LOW: Int,
    val INFO: Int
)

data class TrendPoint(
    val date: String,
    val count: Int
)

data class FileHeatPoint(
    val filePath: String,
    val count: Int
)
