/**
 * Zaim API との通信を担当するドライバー
 * GAS の UrlFetchApp や PropertiesService を使用
 */
export class ZaimApiDriver {
    /**
     * アカウント一覧を取得
     */
    getAccounts() {
        const response = this.callZaimAPI('https://api.zaim.net/v2/home/account', 'GET', { mapping: '1' });
        return response.accounts || [];
    }
    /**
     * 取引データを取得
     * @param accountId アカウントID（オプション）
     */
    getTransactions(accountId) {
        const params = { mapping: '1' };
        if (accountId) {
            params.from_account_id = accountId;
        }
        const response = this.callZaimAPI('https://api.zaim.net/v2/home/money', 'GET', params);
        return response.money || [];
    }
    /**
     * Zaim API を呼び出す（OAuth 1.0a 認証）
     * @private
     */
    callZaimAPI(url, method, queryParams) {
        const consumerKey = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_KEY');
        const consumerSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_CONSUMER_SECRET');
        const accessToken = PropertiesService.getScriptProperties().getProperty('ZAIM_ACCESS_TOKEN');
        const accessTokenSecret = PropertiesService.getScriptProperties().getProperty('ZAIM_ACCESS_TOKEN_SECRET');
        if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
            throw new Error('Zaim OAuth credentials not configured in Script Properties');
        }
        // Generate OAuth parameters
        const oauthParams = this.generateOAuthParams(consumerKey, accessToken);
        // Combine OAuth params with query params
        const allParams = { ...oauthParams, ...queryParams };
        // Generate signature
        const baseString = this.generateSignatureBaseString(method, url, allParams);
        const signature = this.generateSignature(baseString, consumerSecret, accessTokenSecret);
        oauthParams.oauth_signature = signature;
        // Build Authorization header
        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .sort()
            .map(key => `${this.percentEncode(key)}="${this.percentEncode(oauthParams[key])}"`)
            .join(', ');
        // Build URL with query parameters
        let requestUrl = url;
        if (Object.keys(queryParams).length > 0) {
            const queryString = Object.keys(queryParams)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
                .join('&');
            requestUrl += '?' + queryString;
        }
        // Make API request
        const options = {
            method: method === 'GET' ? 'get' : 'post',
            headers: {
                'Authorization': authHeader
            },
            muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(requestUrl, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();
        if (responseCode !== 200) {
            throw new Error(`Zaim API Error (${responseCode}): ${responseText}`);
        }
        return JSON.parse(responseText);
    }
    generateOAuthParams(consumerKey, token = '') {
        const params = {
            oauth_consumer_key: consumerKey,
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: this.getTimestamp(),
            oauth_nonce: this.generateNonce(),
            oauth_version: '1.0'
        };
        if (token) {
            params.oauth_token = token;
        }
        return params;
    }
    generateSignatureBaseString(method, url, params) {
        const sortedKeys = Object.keys(params).sort();
        const paramString = sortedKeys
            .map(key => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
            .join('&');
        return `${method}&${this.percentEncode(url)}&${this.percentEncode(paramString)}`;
    }
    generateSignature(baseString, consumerSecret, tokenSecret = '') {
        const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(tokenSecret)}`;
        const signature = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, baseString, signingKey);
        return Utilities.base64Encode(signature);
    }
    percentEncode(str) {
        return encodeURIComponent(str)
            .replace(/!/g, '%21')
            .replace(/'/g, '%27')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/\*/g, '%2A');
    }
    getTimestamp() {
        return Math.floor(new Date().getTime() / 1000).toString();
    }
    generateNonce() {
        return Utilities.base64Encode(Utilities.getUuid());
    }
}
