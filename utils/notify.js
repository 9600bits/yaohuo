import {
	getAuthHeader,
	hasAuthCookie,
	isLoginRequiredHtml
} from '@/utils/auth.js'
import {
	parseMyReplies
} from '@/utils/list-pages.js'
import {
	request
} from '@/utils/request.js'

const REPLY_SNAPSHOT_KEY = 'yaohuo_reply_snapshot'
const POLL_INTERVAL = 60 * 1000
const MAX_SNAPSHOT = 10

function getReplyPollUrl() {
	let userId = ''
	try {
		userId = String(uni.getStorageSync('yaohuoUserId') || '')
	} catch (e) {}
	return 'https://yaohuo.me/bbs/book_re_my.aspx?action=class&siteid=1000&classid=0&touserid=' +
		encodeURIComponent(userId) + '&lpage=&ot=0'
}

let pollTimer = null
let polling = false

function getSnapshot() {
	try {
		const raw = uni.getStorageSync(REPLY_SNAPSHOT_KEY)
		return Array.isArray(raw) ? raw : []
	} catch (e) {
		return []
	}
}

function setSnapshot(list) {
	try {
		uni.setStorageSync(REPLY_SNAPSHOT_KEY, list.slice(0, MAX_SNAPSHOT))
	} catch (e) {}
}

function createLocalNotification(title, content, payload) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.push && plus.push.createMessage) {
			plus.push.createMessage(content, payload || '', {
				title: title || '妖火网'
			})
		}
	} catch (e) {
		console.log('[YAOHUO_NOTIFY_CREATE_FAIL]', e)
	}
	// #endif
}

export function onReplyNotificationClick(handler) {
	// #ifdef APP-PLUS
	try {
		if (typeof plus !== 'undefined' && plus.push && plus.push.addEventListener) {
			plus.push.addEventListener('click', event => {
				const payload = event && event.payload
				if (payload && String(payload).indexOf('yaohuo:replies') === 0) {
					handler && handler(payload)
				}
			})
		}
	} catch (e) {}
	// #endif
}

export function pollRepliesOnce() {
	if (polling) {
		return Promise.resolve(false)
	}
	if (!hasAuthCookie()) {
		return Promise.resolve(false)
	}
	polling = true
	return request({
		url: getReplyPollUrl(),
		silent: true,
		timeout: 20000
	}).then(res => {
		const html = String(res && res.data || '')
		if (isLoginRequiredHtml(html)) {
			stopReplyPolling()
			return false
		}
		const replies = parseMyReplies(html)
		const snapshot = replies.slice(0, MAX_SNAPSHOT).map(item => `${item.postId || ''}#${item.floor || ''}`)
		const prev = getSnapshot()
		const isFirstRun = !prev.length
		if (!isFirstRun && snapshot.length > prev.length) {
			const prevSet = {}
			prev.forEach(key => {
				prevSet[key] = true
			})
			const fresh = replies.filter(item => !prevSet[`${item.postId || ''}#${item.floor || ''}`]).slice(0, 3)
			const count = snapshot.length - prev.length
			const first = fresh[0] || {}
			const title = count > 1 ? `有 ${count} 条新回复` : '有 1 条新回复'
			const content = first.content ? `${first.content.slice(0, 30)}${first.content.length > 30 ? '…' : ''}` : '点击查看你的帖子回复'
			createLocalNotification(title, content, 'yaohuo:replies:' + (first.postId || ''))
		}
		setSnapshot(snapshot)
		return !isFirstRun && snapshot.length > prev.length
	}).catch(() => {
		return false
	}).then(result => {
		polling = false
		return result
	})
}

export function startReplyPolling() {
	stopReplyPolling()
	if (!hasAuthCookie()) {
		return
	}
	pollRepliesOnce()
	pollTimer = setInterval(() => {
		pollRepliesOnce()
	}, POLL_INTERVAL)
}

export function stopReplyPolling() {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
}
