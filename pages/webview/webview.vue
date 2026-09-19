<template>
	<view class="webview-page">
		<web-view v-if="url && !redirecting" :src="url"></web-view>
		<view v-if="url && !loginMode" class="browser-open-btn" @click.stop="openCurrentUrlInBrowser">浏览器打开</view>
	</view>
</template>

<script>
	import {
		syncAuthCookieFromSystem,
		verifyAuthCookie
	} from '@/utils/auth.js'
	import {
		openInBrowser
	} from '@/utils/browser.js'
	import {
		getNativeRoute
	} from '@/utils/route.js'

	export default {
		data() {
			return {
				url: '',
				loginCheckTimer: null,
				webviewHookTimer: null,
				webviewHookAttempts: 0,
				webviewHooked: false,
				loginMode: false,
				checking: false,
				redirecting: false
			}
		},
		onLoad(option) {
			this.url = decodeURIComponent(option.url || '')
			this.loginMode = option.login === '1' || this.url.indexOf('waplogin.aspx') > -1
			if (!this.loginMode && this.redirectIfNativePost(this.url)) {
				return
			}
			if (this.loginMode) {
				this.startLoginCheck()
			}
		},
		onReady() {
			this.installWebviewHook()
		},
		onUnload() {
			this.stopLoginCheck()
			this.stopWebviewHookTimer()
		},
		methods: {
			openCurrentUrlInBrowser() {
				openInBrowser(this.url)
			},
			redirectIfNativePost(rawUrl) {
				if (this.loginMode || this.redirecting) {
					return false
				}
				const route = getNativeRoute(rawUrl)
				if (!route) {
					return false
				}
				this.redirecting = true
				this.stopLoginCheck()
				uni.redirectTo({
					url: route,
					fail: () => {
						uni.navigateTo({
							url: route
						})
					}
				})
				return true
			},
			installWebviewHook() {
				// #ifdef APP-PLUS
				if (this.loginMode || this.redirecting || this.webviewHooked) {
					return
				}
				this.tryInstallWebviewHook()
				// #endif
			},
			tryInstallWebviewHook() {
				// #ifdef APP-PLUS
				if (this.loginMode || this.redirecting || this.webviewHooked) {
					return
				}
				this.webviewHookAttempts++
				const child = this.getChildWebview()
				if (child && typeof child.addEventListener === 'function') {
					this.webviewHooked = true
					child.addEventListener('loaded', () => {
						const currentUrl = child.getURL ? child.getURL() : ''
						this.redirectIfNativePost(currentUrl)
						this.installWebviewGestures(child)
					})
					this.installWebviewGestures(child)
					return
				}
				if (this.webviewHookAttempts < 10) {
					this.stopWebviewHookTimer()
					this.webviewHookTimer = setTimeout(() => {
						this.tryInstallWebviewHook()
					}, 300)
				}
				// #endif
			},
			getChildWebview() {
				// #ifdef APP-PLUS
				try {
					const current = this.$scope && this.$scope.$getAppWebview ? this.$scope.$getAppWebview() :
						(typeof plus !== 'undefined' && plus.webview ? plus.webview.currentWebview() : null)
					const children = current && current.children ? current.children() : []
					return children && children.length ? children[0] : null
				} catch (e) {
					return null
				}
				// #endif
				return null
			},
			installWebviewGestures(child) {
				// #ifdef APP-PLUS
				if (this.loginMode || this.redirecting || !child || typeof child.evalJS !== 'function') {
					return
				}
				child.evalJS(`(function () {
					if (window.__yaohuoSwipeNavigationInstalled) return;
					window.__yaohuoSwipeNavigationInstalled = true;
					var start = null;
					function point(event) {
						var touches = event.touches && event.touches.length ? event.touches : event.changedTouches;
						var touch = touches && touches.length ? touches[0] : null;
						return touch ? { x: touch.clientX, y: touch.clientY } : null;
					}
					document.addEventListener('touchstart', function (event) {
						start = event.touches && event.touches.length === 1 ? point(event) : null;
					}, { passive: true, capture: true });
					document.addEventListener('touchmove', function (event) {
						var current = point(event);
						if (!start || !current) return;
						var dx = current.x - start.x;
						var dy = current.y - start.y;
						if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 0.8) start = null;
					}, { passive: true, capture: true });
					document.addEventListener('touchend', function (event) {
						var initial = start;
						var current = point(event);
						start = null;
						if (!initial || !current) return;
						var dx = current.x - initial.x;
						var dy = current.y - initial.y;
						if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
						if (dx < 0) history.forward();
						else history.back();
					}, { passive: true, capture: true });
					document.addEventListener('touchcancel', function () { start = null; }, {
						passive: true,
						capture: true
					});
				})();`)
				// #endif
			},
			stopWebviewHookTimer() {
				if (this.webviewHookTimer) {
					clearTimeout(this.webviewHookTimer)
					this.webviewHookTimer = null
				}
			},
			checkLogin() {
				if (!this.loginMode || this.redirecting || this.checking || !syncAuthCookieFromSystem()) {
					return
				}
				this.checking = true
				verifyAuthCookie().then(valid => {
					this.checking = false
					if (!valid) {
						return
					}
					this.redirecting = true
					this.stopLoginCheck()
					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
					setTimeout(() => {
						uni.reLaunch({
							url: '/pages/index/index'
						})
					}, 300)
				})
			},
			startLoginCheck() {
				this.stopLoginCheck()
				this.loginCheckTimer = setInterval(() => {
					this.checkLogin()
				}, 1200)
			},
			stopLoginCheck() {
				if (this.loginCheckTimer) {
					clearInterval(this.loginCheckTimer)
					this.loginCheckTimer = null
				}
			}
		}
	}
</script>

<style lang="scss" scoped>
	.webview-page {
		width: 100vw;
		height: 100vh;
	}

	.browser-open-btn {
		position: fixed;
		right: 24rpx;
		bottom: 34rpx;
		z-index: 20;
		padding: 14rpx 22rpx;
		border-radius: 8rpx;
		background: rgba(7, 193, 96, .92);
		color: #fff;
		font-size: 13px;
		line-height: 1;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .16);
	}
</style>
