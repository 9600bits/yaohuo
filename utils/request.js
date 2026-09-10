import {
	getAuthHeader
} from '@/utils/auth.js'

const DEFAULT_TIMEOUT = 15000
const DEFAULT_FAIL_TIP = '网络异常，请稍后重试'

/**
 * 统一请求封装：
 * - 自动携带登录 Cookie（可通过 header 覆盖）
 * - 默认 15s 超时
 * - 网络失败默认弹 toast，silent=true 可关闭
 * - 返回 Promise<res>，失败 reject(err)
 */
export function request(options) {
	options = options || {}
	const url = options.url || ''
	if (!url) {
		return Promise.reject({
			errMsg: 'request: missing url'
		})
	}
	const header = Object.assign({}, getAuthHeader(options.header), options.header)
	return new Promise((resolve, reject) => {
		uni.request({
			url,
			data: options.data,
			method: options.method || 'GET',
			header,
			timeout: options.timeout || DEFAULT_TIMEOUT,
			success: res => {
				resolve(res)
			},
			fail: err => {
				if (!options.silent) {
					uni.showToast({
						title: options.failTip || DEFAULT_FAIL_TIP,
						icon: 'none'
					})
				}
				reject(err)
			}
		})
	})
}
