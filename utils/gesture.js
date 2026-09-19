const FORWARD_STACK_KEY = '__yaohuo_gesture_forward_stack__'

function getPageLocation(page) {
	if (!page) {
		return ''
	}
	const fullPath = page.$page && page.$page.fullPath
	if (fullPath) {
		return fullPath.charAt(0) === '/' ? fullPath : '/' + fullPath
	}
	const route = page.route || (page.$page && page.$page.route) || ''
	const options = page.options || (page.$page && page.$page.options) || {}
	const query = Object.keys(options).sort().map(key => {
		return encodeURIComponent(key) + '=' + encodeURIComponent(options[key])
	}).join('&')
	return route ? '/' + route + (query ? '?' + query : '') : ''
}

export function clearGestureHistory() {
	try {
		// #ifdef APP-PLUS
		if (typeof plus !== 'undefined' && plus.storage) {
			plus.storage.removeItem(FORWARD_STACK_KEY)
			return
		}
		// #endif
		uni.removeStorageSync(FORWARD_STACK_KEY)
	} catch (e) {}
}

export function installNativePageGestures(vm) {
	// #ifdef APP-PLUS
	try {
		const pages = getCurrentPages()
		const currentPage = pages[pages.length - 1]
		const currentRoute = getPageLocation(currentPage)
		if (!currentRoute || currentRoute.indexOf('/pages/webview/webview') === 0 ||
			currentRoute.indexOf('/pages/login/login') === 0) {
			return
		}
		const previousRoute = pages.length > 1 ? getPageLocation(pages[pages.length - 2]) : ''
		const webview = vm && vm.$scope && vm.$scope.$getAppWebview ? vm.$scope.$getAppWebview() : null
		if (!webview || typeof webview.evalJS !== 'function') {
			return
		}
		webview.evalJS(`(function () {
			if (window.__yaohuoNativeSwipeInstalled) return;
			window.__yaohuoNativeSwipeInstalled = true;
			var currentRoute = ${JSON.stringify(currentRoute)};
			var previousRoute = ${JSON.stringify(previousRoute)};
			var storageKey = ${JSON.stringify(FORWARD_STACK_KEY)};
			var start = null;
			function point(event) {
				var touches = event.touches && event.touches.length ? event.touches : event.changedTouches;
				var touch = touches && touches.length ? touches[0] : null;
				return touch ? { x: touch.clientX, y: touch.clientY } : null;
			}
			function isEditable(target) {
				while (target && target !== document.documentElement) {
					var tag = String(target.tagName || '').toUpperCase();
					if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
						return true;
					}
					target = target.parentElement;
				}
				return false;
			}
			function readStack() {
				try {
					var value = plus.storage.getItem(storageKey);
					var parsed = value ? JSON.parse(value) : [];
					return Array.isArray(parsed) ? parsed : [];
				} catch (e) {
					return [];
				}
			}
			function saveStack(stack) {
				try { plus.storage.setItem(storageKey, JSON.stringify(stack.slice(-20))); } catch (e) {}
			}
			function goBack() {
				if (!previousRoute) return;
				var stack = readStack();
				stack.push({ from: previousRoute, to: currentRoute });
				saveStack(stack);
				uni.navigateBack({
					fail: function () {
						stack.pop();
						saveStack(stack);
					}
				});
			}
			function goForward() {
				var stack = readStack();
				var entry = stack.length ? stack[stack.length - 1] : null;
				if (!entry || entry.from !== currentRoute) return;
				stack.pop();
				saveStack(stack);
				uni.navigateTo({
					url: entry.to,
					fail: function () {
						stack.push(entry);
						saveStack(stack);
					}
				});
			}
			document.addEventListener('touchstart', function (event) {
				start = event.touches && event.touches.length === 1 && !isEditable(event.target) ? point(event) : null;
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
				if (dx > 0) goBack();
				else goForward();
			}, { passive: true, capture: true });
			document.addEventListener('touchcancel', function () { start = null; }, {
				passive: true,
				capture: true
			});
		})();`)
	} catch (e) {}
	// #endif
}
