package io.secureai.android.data.remote.api

import io.secureai.android.data.remote.model.ApiResponse
import io.secureai.android.data.remote.model.DashboardResponse
import io.secureai.android.data.remote.model.PagedVulnerabilityResponse
import io.secureai.android.data.remote.model.VulnerabilityDto
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface DashboardApi {

    @GET("api/v1/projects/{projectId}/dashboard")
    suspend fun getDashboard(
        @Path("projectId") projectId: String
    ): ApiResponse<DashboardResponse>

    @GET("api/v1/projects/{projectId}/vulnerabilities")
    suspend fun getVulnerabilities(
        @Path("projectId") projectId: String,
        @Query("page") page: Int = 0,
        @Query("size") size: Int = 20,
        @Query("severity") severity: String? = null
    ): ApiResponse<PagedVulnerabilityResponse>

    @GET("api/v1/projects/{projectId}/vulnerabilities/{vulnId}")
    suspend fun getVulnerabilityDetail(
        @Path("projectId") projectId: String,
        @Path("vulnId") vulnId: String
    ): ApiResponse<VulnerabilityDto>
}
