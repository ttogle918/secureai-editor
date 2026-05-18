package io.secureai.android.data.remote.model

import com.google.gson.annotations.SerializedName

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?,
    @SerializedName("message") val message: String?
) {
    fun requireData(): T = data ?: throw IllegalStateException("응답 데이터가 없습니다.")
}
