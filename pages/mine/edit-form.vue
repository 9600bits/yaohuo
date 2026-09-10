<template>
	<view class="page">
		<view v-if="tip" class="tip">{{tip}}</view>
		<view class="card">
			<view v-if="needsPassword" class="password-gate">
				<text class="gate-title">需要验证密码</text>
				<text class="gate-desc">请先输入当前账号密码，验证通过后继续修改资料。</text>
			</view>

			<view v-for="field in visibleFields" :key="field.name" class="form-row">
				<text class="label">{{field.label}}</text>
				<picker v-if="field.options && field.options.length" mode="selector" :range="field.options" range-key="label"
					:value="getOptionIndex(field)" @change="changeSelect(field,$event)">
					<view class="select-control">
						<text>{{getOptionLabel(field)}}</text>
						<uni-icons type="arrowdown" size="15" color="#7a8781"></uni-icons>
					</view>
				</picker>
				<picker v-else-if="field.type === 'date'" mode="date" :value="form[field.name]"
					@change="changeDate(field,$event)">
					<view class="select-control">
						<text>{{form[field.name] || '请选择'}}</text>
						<uni-icons type="calendar" size="15" color="#7a8781"></uni-icons>
					</view>
				</picker>
				<textarea v-else-if="field.multiline" class="textarea" v-model="form[field.name]" :maxlength="-1"
					auto-height :show-confirm-bar="false"></textarea>
				<input v-else class="input" :type="field.inputType || 'text'" :password="field.password" v-model="form[field.name]"
					:placeholder="field.placeholder || field.label" @input="handleFieldInput(field,$event)" />
			</view>

			<view v-if="mode === 'avatar' && currentAvatar" class="current-avatar-section">
				<text class="label">当前头像</text>
				<image class="current-avatar" :src="currentAvatar" mode="aspectFill"></image>
			</view>

			<view v-if="mode === 'avatar' && systemHeadImages.length" class="head-section">
				<view class="head-title-row">
					<text class="label">系统头像</text>
					<view class="gender-tabs">
						<view class="gender-tab" :class="{active: headGender === 'male'}" @click="setHeadGender('male')">男</view>
						<view class="gender-tab" :class="{active: headGender === 'female'}" @click="setHeadGender('female')">女</view>
					</view>
				</view>
				<view class="head-grid">
					<image v-for="item in systemHeadImages" :key="item" class="head-image"
						:class="{active: selectedHeadUrl === item}" :src="item" mode="aspectFill" @click="selectHead(item)"></image>
				</view>
			</view>

			<view v-if="mode === 'avatar' && headImages.length" class="head-section">
				<text class="label">页面头像</text>
				<view class="head-grid">
					<image v-for="item in headImages" :key="item" class="head-image" :class="{active: selectedHeadUrl === item}"
						:src="item" mode="aspectFill" @click="selectHead(item)"></image>
				</view>
			</view>

			<view v-if="mode === 'avatar'" class="avatar-helper">
				<text class="helper-text">也可以粘贴站内图片地址作为头像。</text>
				<button v-if="avatarUploadUrl" class="secondary-btn" size="mini" @click="openAvatarUpload">从相册上传</button>
			</view>

			<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || loading"
				@click="submitForm">{{submitText}}</button>
		</view>
	</view>
</template>

<script>
	import {
		clearAuthCookie,
		isLoginRequiredHtml
	} from '@/utils/auth.js'
	import {
		request
	} from '@/utils/request.js'
	import {
		absoluteYaohuoUrl,
		decodeHtml,
		getAttr,
		stripHtml
	} from '@/utils/html.js'
	import {
		navigateToNativeRoute
	} from '@/utils/route.js'
	import {
		chooseYaohuoLocalFile,
		extractYaohuoAlbumUploadTip,
		isYaohuoAlbumUploadSuccess,
		uploadYaohuoAlbumImage
	} from '@/utils/yaohuo-upload.js'

	const LABELS = {
		tonickname: '昵称',
		remark: '个性签名',
		sex: '性别',
		fenfuo: '性别',
		birthday: '生日',
		aihao: '爱好',
		city: '城市',
		zhiye: '职业',
		shenggao: '身高',
		tizhong: '体重',
		mobile: '手机',
		email: '邮箱',
		qq: 'QQ号',
		txtoldPW: '原密码',
		txtnewPW: '新密码',
		txtrePW: '确认新密码',
		toheadimg: '头像地址',
		sysimg: '头像类型',
		needpassword: '当前密码',
		bindqqnumber: '安全邮箱 QQ',
		imageCaptcha: '图形验证码'
	}

	export default {
		data() {
			return {
				mode: '',
				title: '',
				url: '',
				action: '',
				fields: [],
				form: {},
				tip: '',
				headImages: [],
				systemHeadImages: [],
				currentAvatar: '',
				selectedHeadUrl: '',
				avatarUploadUrl: '',
				headGender: 'male',
				needsPassword: false,
				lastHtml: '',
				avatarUploading: false,
				loading: false,
				submitting: false
			}
		},
		computed: {
			visibleFields() {
				return this.fields.filter(field => !field.hidden)
			},
			submitText() {
				if (this.needsPassword) {
					return '验证密码'
				}
				if (this.mode === 'password') {
					return '确认修改'
				}
				if (this.mode === 'avatar') {
					return '设为头像'
				}
				return '保存资料'
			}
		},
		onLoad(option) {
			option = option || {}
			this.mode = option.mode || ''
			this.title = option.title ? decodeURIComponent(option.title) : this.getDefaultTitle()
			this.url = option.url ? decodeURIComponent(option.url) : this.getDefaultUrl()
			uni.setNavigationBarTitle({
				title: this.title || this.getDefaultTitle()
			})
			this.fetchForm()
		},
		methods: {
			getDefaultTitle() {
				if (this.mode === 'password') return '更改密码'
				if (this.mode === 'avatar') return '更换头像'
				return '修改资料'
			},
			getDefaultUrl() {
				if (this.mode === 'password') return 'https://yaohuo.me/bbs/ModifyPW.aspx'
				if (this.mode === 'avatar') return 'https://yaohuo.me/bbs/ModifyHead.aspx'
				return 'https://yaohuo.me/bbs/EditProfile.aspx'
			},
			fetchForm() {
				this.loading = true
				request({
					url: absoluteYaohuoUrl(this.url),
					failTip: '加载失败'
				}).then(res => {
						const html = String(res.data || '')
						this.lastHtml = html
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						const parsed = this.parseFormPage(html)
						this.applyParsedForm(parsed)
				}).catch(() => {}).then(() => {
						this.loading = false
				})
			},
			applyParsedForm(parsed) {
				this.action = parsed.action
				this.fields = parsed.fields
				this.form = parsed.form
				this.tip = parsed.tip
				this.headImages = parsed.headImages
				this.systemHeadImages = parsed.systemHeadImages || []
				this.currentAvatar = parsed.currentAvatar || ''
				this.avatarUploadUrl = parsed.avatarUploadUrl || ''
				this.needsPassword = parsed.needsPassword || false
				this.selectedHeadUrl = this.form.toheadimg ? absoluteYaohuoUrl(this.form.toheadimg) : ''
			},
			parseFormPage(html) {
				const formHtml = this.pickForm(html)
				const action = this.getFormAction(formHtml) || absoluteYaohuoUrl(this.url)
				const fields = []
				const form = {}
				this.parseInputs(formHtml, fields, form)
				this.parseTextareas(formHtml, fields, form)
				this.parseSelects(formHtml, fields, form)
				const tip = this.extractResultText(html)
				const needsPassword = this.isPasswordGatePage(html, form)
				return {
					action,
					fields: this.normalizeFields(fields),
					form,
					tip,
					headImages: this.parseHeadImages(html),
					systemHeadImages: this.parseSystemHeadImages(html),
					currentAvatar: this.parseCurrentAvatar(html),
					avatarUploadUrl: this.parseAvatarUploadUrl(html),
					needsPassword
				}
			},
			pickForm(html) {
				const forms = String(html || '').match(/<form\b[\s\S]*?<\/form>/ig) || []
				if (!forms.length) return ''
				if (this.mode === 'profile') {
					return forms.find(form => /tonickname|remark|birthday/i.test(form)) || forms[0]
				}
				return forms[0]
			},
			getFormAction(formHtml) {
				const tag = String(formHtml || '').match(/<form\b[^>]*>/i)
				const action = tag ? getAttr(tag[0], 'action') : ''
				return action ? absoluteYaohuoUrl(action) : ''
			},
			parseInputs(formHtml, fields, form) {
				const reg = /<input\b[^>]*>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = match[0]
					const name = getAttr(tag, 'name')
					if (!name) continue
					const type = String(getAttr(tag, 'type') || 'text').toLowerCase()
					const value = getAttr(tag, 'value') || ''
					if (type === 'radio') {
						this.addRadioField(fields, form, name, value, stripHtml(tag) || value, /checked/i.test(tag))
						continue
					}
					form[name] = form[name] !== undefined ? form[name] : value
					fields.push({
						name,
						label: this.getLabel(name),
						hidden: type === 'hidden' || name === 'f',
						password: type === 'password' || /pw|pass/i.test(name),
						placeholder: getAttr(tag, 'placeholder'),
						type,
						inputType: this.getInputType(type)
					})
				}
			},
			getInputType(type) {
				if (type === 'number' || type === 'tel' || type === 'email') {
					return type
				}
				return 'text'
			},
			parseTextareas(formHtml, fields, form) {
				const reg = /<textarea\b[^>]*>[\s\S]*?<\/textarea>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = (match[0].match(/<textarea\b[^>]*>/i) || [])[0] || ''
					const name = getAttr(tag, 'name')
					if (!name) continue
					const body = match[0].replace(/^<textarea\b[^>]*>/i, '').replace(/<\/textarea>$/i, '')
					form[name] = decodeHtml(body)
					fields.push({
						name,
						label: this.getLabel(name),
						multiline: true
					})
				}
			},
			parseSelects(formHtml, fields, form) {
				const reg = /<select\b[^>]*>[\s\S]*?<\/select>/ig
				let match
				while ((match = reg.exec(String(formHtml || '')))) {
					const tag = (match[0].match(/<select\b[^>]*>/i) || [])[0] || ''
					const name = getAttr(tag, 'name')
					if (!name) continue
					const options = []
					const optionMap = {}
					const optionReg = /<option\b[^>]*>[\s\S]*?<\/option>/ig
					let option
					while ((option = optionReg.exec(match[0]))) {
						const optionTag = (option[0].match(/<option\b[^>]*>/i) || [])[0] || ''
						const value = getAttr(optionTag, 'value') || stripHtml(option[0])
						const label = this.cleanOptionLabel(stripHtml(option[0]), value)
						const oldOption = optionMap[value]
						if (oldOption) {
							if (this.isBetterOptionLabel(label, oldOption.label, value)) {
								oldOption.label = label
							}
						} else {
							const item = {
								value,
								label
							}
							optionMap[value] = item
							options.push(item)
						}
						if (/selected/i.test(optionTag) || form[name] === undefined) {
							form[name] = value
						}
					}
					fields.push({
						name,
						label: this.getLabel(name),
						options
					})
				}
			},
			cleanOptionLabel(label, value) {
				label = String(label || '').trim()
				value = String(value || '').trim()
				if (value && label.indexOf(value + '_') === 0) {
					return label.slice(value.length + 1).trim()
				}
				return label || value
			},
			isBetterOptionLabel(label, oldLabel, value) {
				label = String(label || '').trim()
				oldLabel = String(oldLabel || '').trim()
				value = String(value || '').trim()
				if (!label || label === oldLabel) {
					return false
				}
				if (oldLabel === value && label !== value) {
					return true
				}
				return oldLabel.length <= 1 && label.length > oldLabel.length
			},
			addRadioField(fields, form, name, value, label, checked) {
				let field = fields.find(item => item.name === name)
				if (!field) {
					field = {
						name,
						label: this.getLabel(name),
						options: []
					}
					fields.push(field)
				}
				field.options.push({
					value,
					label: label || value
				})
				if (checked || form[name] === undefined) {
					form[name] = value
				}
			},
			normalizeFields(fields) {
				const seen = {}
				return fields.filter(field => {
					if (!field.name || seen[field.name]) return false
					seen[field.name] = true
					if (field.name === 'action' || field.name === 'siteid' || field.name === 'classid' || field.name === '__CSRFToken' ||
						field.name === 'sysimg') {
						field.hidden = true
					}
					return true
				})
			},
			parseHeadImages(html) {
				const urls = []
				const seen = {}
				const reg = /<img\b[^>]*src\s*=\s*(["'])([^"']*(?:\/bbs\/head\/\d+\.gif|\/album\/upload\/[^"']+)[^"']*)\1[^>]*>/ig
				let match
				while ((match = reg.exec(String(html || '')))) {
					const url = absoluteYaohuoUrl(match[2])
					if (!seen[url]) {
						seen[url] = true
						urls.push(url)
					}
				}
				return urls
			},
			parseSystemHeadImages(html) {
				const config = this.parseModifyHeadConfig(html)
				if (!config.baseUrl || !config.maleCount && !config.femaleCount) {
					return []
				}
				const count = this.headGender === 'female' ? config.femaleCount : config.maleCount
				const offset = this.headGender === 'female' ? config.femaleOffset : config.maleOffset
				const urls = []
				for (let i = 1; i <= count; i++) {
					urls.push(absoluteYaohuoUrl(`${config.baseUrl}${offset + i}.gif`))
				}
				return urls
			},
			parseModifyHeadConfig(html) {
				const source = String(html || '')
				const baseUrl = this.extractJsConfigValue(source, 'baseUrl') || '/bbs/head/'
				const maleCount = Number(this.extractJsConfigValue(source, 'maleCount') || 0)
				const femaleCount = Number(this.extractJsConfigValue(source, 'femaleCount') || 0)
				return {
					baseUrl,
					maleCount,
					femaleCount,
					maleOffset: 0,
					femaleOffset: maleCount
				}
			},
			extractJsConfigValue(source, name) {
				const reg = new RegExp(`${name}\\s*:\\s*(?:'([^']*)'|"([^"]*)"|(\\d+))`, 'i')
				const match = String(source || '').match(reg)
				return match ? (match[1] !== undefined ? match[1] : match[2] !== undefined ? match[2] : match[3]) : ''
			},
			parseCurrentAvatar(html) {
				const block = String(html || '').match(/<div\b[^>]*class\s*=\s*(["'])[^"']*\bavatar-box\b[^"']*\1[^>]*>[\s\S]*?<\/div>/i)
				const img = block ? block[0].match(/<img\b[^>]*src\s*=\s*(["'])([^"']+)\1/i) : null
				return img ? absoluteYaohuoUrl(img[2]) : ''
			},
			parseAvatarUploadUrl(html) {
				const match = String(html || '').match(/<a\b[^>]*href\s*=\s*(["'])([^"']*album\/admin_WAPadd\.aspx[^"']*)\1/i)
				return match ? absoluteYaohuoUrl(match[2]) : ''
			},
			isPasswordGatePage(html, form) {
				return !!(form && Object.prototype.hasOwnProperty.call(form, 'needpassword')) ||
					/此操作需验证密码|请输入密码/.test(stripHtml(String(html || '')))
			},
			getLabel(name) {
				return LABELS[name] || name
			},
			getOptionIndex(field) {
				const value = this.form[field.name]
				const index = (field.options || []).findIndex(item => item.value === value)
				return index > -1 ? index : 0
			},
			getOptionLabel(field) {
				const option = (field.options || [])[this.getOptionIndex(field)]
				return option ? option.label : '请选择'
			},
			changeSelect(field, e) {
				const index = Number(e.detail.value || 0)
				const option = (field.options || [])[index]
				if (option) {
					this.$set(this.form, field.name, option.value)
				}
			},
			changeDate(field, e) {
				this.$set(this.form, field.name, e.detail.value || '')
			},
			handleFieldInput(field, e) {
				if (!field || field.name !== 'toheadimg') {
					return
				}
				const value = String(e && e.detail ? e.detail.value : this.form.toheadimg || '').trim()
				this.selectedHeadUrl = value ? absoluteYaohuoUrl(value) : ''
			},
			setHeadGender(gender) {
				this.headGender = gender === 'female' ? 'female' : 'male'
				this.systemHeadImages = this.parseSystemHeadImages(this.lastHtml || '')
			},
			selectHead(url) {
				this.selectedHeadUrl = url
				const match = String(url || '').match(/\/bbs\/head\/(\d+)\.gif/i)
				if (match) {
					this.$set(this.form, 'toheadimg', '')
					this.$set(this.form, 'sysimg', match[1])
					return
				}
				this.$set(this.form, 'toheadimg', this.normalizeAvatarPath(url))
			},
			openAvatarUpload() {
				if (this.avatarUploading) {
					return uni.showToast({
						title: '正在上传头像',
						icon: 'none'
					})
				}
				uni.showActionSheet({
					itemList: ['拍摄', '相册', '文件管理器'],
					success: res => {
						const sources = ['camera', 'album', 'file']
						this.pickAvatarUploadSource(sources[res.tapIndex] || 'album')
					}
				})
			},
			pickAvatarUploadSource(source) {
				if (source === 'file') {
					chooseYaohuoLocalFile(1).then(files => {
						this.uploadAvatarImage(files[0])
					}).catch(err => {
						console.log('[YAOHUO_AVATAR_UPLOAD_PICK_RESULT]', {
							source,
							hasFile: false,
							errMsg: (err && err.message) || String(err || '')
						})
						const message = (err && err.message) || ''
						if (/不支持文件选择/.test(message)) {
							this.openAvatarUploadFallback()
							return
						}
						uni.showToast({
							title: '未选择文件',
							icon: 'none'
						})
					})
					return
				}
				this.pickAvatarImage(source)
			},
			pickAvatarImage(source) {
				let picked = false
				try {
					uni.chooseImage({
						count: 1,
						sourceType: [source === 'camera' ? 'camera' : 'album'],
						success: res => {
							picked = true
							const tempFilePaths = res.tempFilePaths || []
							const tempFiles = res.tempFiles || []
							const path = tempFilePaths[0] || (tempFiles[0] && (tempFiles[0].path || tempFiles[0].tempFilePath)) || ''
							console.log('[YAOHUO_AVATAR_UPLOAD_PICK_RESULT]', {
								source,
								hasFile: !!path,
								count: tempFilePaths.length || tempFiles.length
							})
							this.uploadAvatarImage({
								path,
								name: this.getFileName(path),
								size: tempFiles[0] && tempFiles[0].size || 0
							})
						},
						fail: err => {
							console.log('[YAOHUO_AVATAR_UPLOAD_PICK_RESULT]', {
								source,
								hasFile: false,
								errMsg: err && err.errMsg || ''
							})
							uni.showToast({
								title: '未选择图片',
								icon: 'none'
							})
						}
					})
				} catch (err) {
					console.log('[YAOHUO_AVATAR_UPLOAD_PICK_RESULT]', {
						source,
						hasFile: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showToast({
						title: '选择失败',
						icon: 'none'
					})
				}
			},
			uploadAvatarImage(file) {
				if (!file || !file.path) {
					return uni.showToast({
						title: '未选择图片',
						icon: 'none'
					})
				}
				this.avatarUploading = true
				uni.showLoading({
					title: '上传头像'
				})
				uploadYaohuoAlbumImage({
					file,
					url: this.avatarUploadUrl || 'https://yaohuo.me/album/admin_WAPadd.aspx',
					title: '自定义头像'
				}).then(res => {
					const html = String(res.data || '')
					const imageUrl = res.imageUrl || this.extractLatestAlbumImageUrl(html)
					const tip = res.tip || extractYaohuoAlbumUploadTip(html)
					const success = Number(res.statusCode || 0) < 400 && isYaohuoAlbumUploadSuccess(html, imageUrl)
					uni.hideLoading()
					this.avatarUploading = false
					console.log('[YAOHUO_AVATAR_UPLOAD_RESULT]', {
						statusCode: res.statusCode,
						success,
						imageUrl,
						fileName: res.fileName,
						fileSize: res.fileSize,
						tip,
						text: stripHtml(html).slice(0, 500)
					})
					if (!success || !imageUrl) {
						return uni.showModal({
							title: '头像上传失败',
							content: tip || '服务器没有返回上传后的图片地址',
							showCancel: false
						})
					}
					this.applyUploadedAvatar(imageUrl)
					uni.showModal({
						title: '上传成功',
						content: '已填入头像地址，点“设为头像”即可完成更换。',
						showCancel: false
					})
				}).catch(err => {
					uni.hideLoading()
					this.avatarUploading = false
					console.log('[YAOHUO_AVATAR_UPLOAD_RESULT]', {
						success: false,
						errMsg: (err && err.message) || String(err || '')
					})
					uni.showModal({
						title: '头像上传失败',
						content: (err && err.message) || '妖火相册上传接口暂时不可用',
						showCancel: false
					})
				})
			},
			applyUploadedAvatar(url) {
				const absoluteUrl = absoluteYaohuoUrl(url)
				const path = this.normalizeAvatarPath(absoluteUrl)
				this.selectedHeadUrl = absoluteUrl
				this.$set(this.form, 'toheadimg', path)
				this.$set(this.form, 'sysimg', '')
				if (this.headImages.indexOf(absoluteUrl) === -1) {
					this.headImages.unshift(absoluteUrl)
				}
			},
			extractLatestAlbumImageUrl(html) {
				const source = String(html || '')
				let latest = ''
				const reg = /(?:src|href|data-full-src)\s*=\s*(["'])([^"']*\/album\/upload\/[^"']+\.(?:jpe?g|png|gif|webp)(?:\?[^"']*)?)\1/ig
				let match
				while ((match = reg.exec(source))) {
					latest = absoluteYaohuoUrl(match[2])
				}
				return latest
			},
			openAvatarUploadFallback() {
				const url = this.avatarUploadUrl || 'https://yaohuo.me/album/admin_WAPadd.aspx'
				uni.showModal({
					title: '头像上传',
					content: '当前环境不支持原生文件选择，可打开妖火官方上传页。',
					confirmText: '打开',
					showCancel: true,
					success: res => {
						if (res.confirm) {
							if (navigateToNativeRoute(url)) {
								return
							}
							uni.navigateTo({
								url: `/pages/webview/webview?url=${encodeURIComponent(url)}`
							})
						}
					}
				})
			},
			getFileName(path) {
				path = String(path || '')
				return path.split(/[\\/]/).pop() || 'avatar.jpg'
			},
			submitForm() {
				if (!this.action || this.submitting) return
				this.submitting = true
				request({
					url: this.action,
					method: 'POST',
					header: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Referer: absoluteYaohuoUrl(this.url)
					},
					data: this.formEncode(this.form),
					failTip: '提交失败'
				}).then(res => {
						const html = String(res.data || '')
						const text = this.extractResultText(html)
						if (this.needsPassword) {
							this.handleProfilePasswordResponse(res, html, text)
							return
						}
						const ok = this.isSubmitSuccess(html, text)
						uni.showModal({
							title: ok ? '提交成功' : '提交结果',
							content: text.slice(0, 180) || '服务器未返回明确结果',
							showCancel: false,
							success: () => {
								if (ok) {
									uni.navigateBack()
								}
							}
						})
				}).catch(() => {}).then(() => {
						this.submitting = false
				})
			},
			handleProfilePasswordResponse(res, html, text) {
				if (this.isProfilePasswordFailure(res, html, text)) {
					uni.showModal({
						title: '验证失败',
						content: text.slice(0, 180) || '密码验证失败，请重新输入。',
						showCancel: false
					})
					return
				}
				if (this.isProfilePasswordSuccess(res, html)) {
					this.url = 'https://yaohuo.me/bbs/EditProfile.aspx?pwdStatus=success'
					this.submitting = false
					this.fetchForm()
					return
				}
				this.url = 'https://yaohuo.me/bbs/EditProfile.aspx?pwdStatus=success'
				this.submitting = false
				this.fetchVerifiedProfileForm()
			},
			fetchVerifiedProfileForm() {
				this.loading = true
				request({
					url: absoluteYaohuoUrl(this.url),
					header: {
						Referer: 'https://yaohuo.me/bbs/EditProfile.aspx'
					},
					failTip: '资料页加载失败'
				}).then(res => {
						const html = String(res.data || '')
						this.lastHtml = html
						if (isLoginRequiredHtml(html)) {
							return this.goLogin()
						}
						if (this.isPasswordGatePage(html, {})) {
							this.url = 'https://yaohuo.me/bbs/EditProfile.aspx'
							uni.showModal({
								title: '验证结果',
								content: '服务器没有返回明确验证结果，请重新验证一次。',
								showCancel: false
							})
							return
						}
						const parsed = this.parseFormPage(html)
						if (!parsed.form || !parsed.form.tonickname) {
							uni.showModal({
								title: '加载失败',
								content: this.extractResultText(html) || '没有读取到资料编辑表单。',
								showCancel: false
							})
							return
						}
						this.applyParsedForm(parsed)
				}).catch(() => {}).then(() => {
						this.loading = false
				})
			},
			isProfilePasswordSuccess(res, html) {
				if (Number(res && res.statusCode || 0) >= 300 && Number(res && res.statusCode || 0) < 400) {
					return true
				}
				if (Number(res && res.statusCode || 0) === 200 && !String(html || '').trim()) {
					return true
				}
				return /tonickname|editProfileForm|编辑个人资料/.test(String(html || '')) && !this.isPasswordGatePage(html, {})
			},
			isProfilePasswordFailure(res, html, text) {
				if (Number(res && res.statusCode || 0) >= 400) {
					return true
				}
				const source = String(text || this.extractResultText(html) || '')
				return /密码.*(?:错误|不正确|不能为空)|验证失败|失败|错误/.test(source)
			},
			isSubmitSuccess(html, text) {
				text = text || this.extractResultText(html)
				return /成功|已保存|修改成功|设置成功|资料更新成功/.test(text) && !/失败|错误|不能为空|密码不能为空|验证码|不正确|无权限/.test(text)
			},
			normalizeAvatarPath(url) {
				const text = String(url || '').trim()
				if (!text) {
					return ''
				}
				if (/^https?:\/\//i.test(text)) {
					const match = text.match(/^https?:\/\/(?:[^/]+\.)?yaohuo\.me\/(.+)$/i)
					return match ? match[1] : text
				}
				return text.replace(/^\/+/, '')
			},
			formEncode(data) {
				return Object.keys(data || {}).map(key => {
					const value = data[key] === undefined || data[key] === null ? '' : data[key]
					return encodeURIComponent(key) + '=' + encodeURIComponent(value)
				}).join('&')
			},
			extractResultText(html) {
				const source = String(html || '')
				let text = ''
				const blockReg = /<div\b[^>]*class\s*=\s*(["'])([^"']*)\1[^>]*>([\s\S]*?)<\/div>/ig
				let match
				while ((match = blockReg.exec(source))) {
					const className = String(match[2] || '').trim()
					const classTokens = className.split(/\s+/)
					const isMessageBlock = classTokens.indexOf('modern-alert') > -1 || classTokens.indexOf('tip') > -1 ||
						classTokens.indexOf('message') > -1 || className === 'content'
					if (!isMessageBlock) {
						continue
					}
					const block = match[3] || ''
					if (/<(?:input|select|textarea|form)\b/i.test(block)) {
						continue
					}
					const candidate = stripHtml(block).replace(/\s+/g, ' ').trim()
					if (candidate && !/^(论坛信息|联系方式|当前头像|头像预览|原密码|昵称|标题|内容)\b/.test(candidate)) {
						text = candidate
						break
					}
				}
				if (!text && !/<form\b/i.test(source)) {
					text = stripHtml(source).replace(/\s+/g, ' ').trim()
				}
				const lines = text.split(/\s*(?:返回上级|返回首页|论坛信息|联系方式|原密码|当前头像)\s*/).filter(Boolean)
				return (lines[0] || text).slice(0, 300)
			},
			goLogin() {
				clearAuthCookie()
				uni.redirectTo({
					url: '/pages/login/login?clear=1'
				})
			}
		}
	}
</script>

<style scoped>
	page {
		background: #f4f6f5;
	}

	.page {
		padding: 18rpx;
		box-sizing: border-box;
	}

	.card {
		padding: 22rpx 20rpx;
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, .04);
	}

	.tip {
		margin-bottom: 16rpx;
		padding: 16rpx;
		border-radius: 8px;
		background: #eaf8f1;
		color: #087f77;
		font-size: 14px;
	}

	.password-gate {
		margin-bottom: 22rpx;
		padding: 18rpx;
		border-radius: 8px;
		background: #f2faf6;
		border: 1px solid #d7eee2;
	}

	.gate-title {
		display: block;
		color: #1f6b4a;
		font-size: 15px;
		font-weight: 700;
	}

	.gate-desc {
		display: block;
		margin-top: 8rpx;
		color: #607168;
		font-size: 13px;
		line-height: 20px;
	}

	.form-row {
		margin-bottom: 20rpx;
	}

	.label {
		display: block;
		margin-bottom: 10rpx;
		color: #20352c;
		font-size: 14px;
		font-weight: 700;
	}

	.input,
	.textarea,
	.select-control {
		width: 100%;
		min-height: 76rpx;
		padding: 0 18rpx;
		border: 1px solid #dfe7e2;
		border-radius: 7px;
		background: #fff;
		color: #202b27;
		font-size: 14px;
		box-sizing: border-box;
	}

	.textarea {
		min-height: 150rpx;
		padding: 16rpx 18rpx;
		line-height: 21px;
	}

	.select-control {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.head-section {
		margin: 8rpx 0 24rpx;
	}

	.current-avatar-section {
		margin: 8rpx 0 24rpx;
	}

	.current-avatar {
		width: 136rpx;
		height: 136rpx;
		border-radius: 10px;
		background: #f3f4f6;
	}

	.head-title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10rpx;
	}

	.head-title-row .label {
		margin-bottom: 0;
	}

	.gender-tabs {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 4rpx;
		border-radius: 999px;
		background: #edf6f1;
	}

	.gender-tab {
		min-width: 72rpx;
		height: 48rpx;
		line-height: 48rpx;
		text-align: center;
		border-radius: 999px;
		color: #5f7168;
		font-size: 13px;
	}

	.gender-tab.active {
		background: #07c160;
		color: #fff;
		font-weight: 700;
	}

	.head-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14rpx;
	}

	.head-image {
		width: 128rpx;
		height: 128rpx;
		border-radius: 8px;
		border: 2px solid transparent;
		background: #f3f4f6;
	}

	.head-image.active {
		border-color: #08a878;
	}

	.avatar-helper {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin: 8rpx 0 24rpx;
		padding: 16rpx;
		border-radius: 8px;
		background: #f7fbf8;
		border: 1px solid #e3ece6;
	}

	.helper-text {
		flex: 1;
		color: #61736a;
		font-size: 13px;
		line-height: 20px;
	}

	.secondary-btn {
		margin: 0;
		border-radius: 999px;
		background: #eef7f2;
		color: #2f6f55;
		font-size: 12px;
	}

	.submit-btn {
		height: 82rpx;
		line-height: 82rpx;
		margin: 22rpx 0 0;
		border-radius: 8px;
		background: #07c160;
		color: #fff;
	}
</style>
