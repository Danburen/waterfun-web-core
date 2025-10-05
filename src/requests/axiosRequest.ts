import axios from 'axios'
import { ElMessage } from "element-plus";
import { translate } from "~/utils/cachePool";
import {getErrorMessage} from "~/utils/errorMessage";
import {useAuthStore} from "~/stores/authStore";

declare module 'axios' {
    interface AxiosRequestConfig {
        meta?: {
            needCSRF?: boolean;
            showError?: boolean;
            needAuth?: boolean;
        };
    }
}
const CSRF_SKIP_LIST: string[] = import.meta.env.VITE_CSRF_SKIP_LIST?.split(',') || [];
const AUTH_SKIP_LIST: string[] = import.meta.env.VITE_AUTH_SKIP_LIST?.split(',') || [];
const service = axios.create({
    baseURL: import.meta.env.VITE_API_BASE,
    timeout: 5000,
    withCredentials: true //allow credentials and cookies
})

// request interceptors
service.interceptors.request.use(
    async config => {
        const isAuthSkip = AUTH_SKIP_LIST.some((path: string) => config.url?.includes(path));
        const isCsrfSkip = CSRF_SKIP_LIST.some((path: string) => config.url?.includes(path));
        const needCSRF = config.meta?.needCSRF !== false && !isCsrfSkip;
        const needAuth = config.meta?.needAuth !== false && !isAuthSkip;

        const token = useAuthStore().accessData.token;
        if (config.method !== 'GET' && needCSRF) {
            let CSRFToken = getCsrfToken()
            if (!CSRFToken) {
                console.log('First request,now try get csrf token');
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_BASE}/auth/csrf-token`, {
                        credentials: 'include'
                    });
                    if (!response.ok) return Promise.reject(new Error(`Failed to fetch CSRF Token.Code ${response.status}`));
                    CSRFToken = getCsrfToken();
                } catch (error) {
                    return Promise.reject(error);
                }
            }
            config.headers['X-XSRF-TOKEN'] = CSRFToken;
        }

        if(needAuth){
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (config.method == 'GET') {
            config.params = {
                _t: Date.now(),
                _n: Math.random().toString(36).slice(2),
                ...config.params
            }
        }
        return config;
    },
    error => {
        return Promise.reject(error)
    }
)

// response interceptors
service.interceptors.response.use(
    response => {
        if (response.status !== 200) {
            console.error(response);
            return Promise.reject(new Error(response.data.message || 'Error'))
        } else {
            return response.data
        }
    },
    error => {
        let showError = error.config.meta?.showError !== false;
        let errMessage
        if(error.response) {
            const status = error.response.status
            errMessage = getErrorMessage(error.response.data.code || error.response.status)
            if(errMessage === 'unknownError') { showError = false ; console.log(error.response.data.code); }
            switch (status) {
                case 401:
                    // window.location.href = '/login'
                    return Promise.reject(new Error('Unauthorized'))
            }
            if(showError) {
                ElMessage({
                    message: errMessage,
                    type: 'error',
                    duration: 3000
                })
            }
            return Promise.reject(new Error(error.response.data))
        }else if(error.request) {
            // no response
            errMessage = translate("message.error.networkError")
        }else{
            errMessage = translate("message.error.sendRequestError");
        }
        if(showError) {
            ElMessage({
                message: errMessage,
                type: 'error',
            })
        }
        return Promise.reject(new Error(errMessage));
    }
)

// get CSRF Token From cookie
function getCsrfToken() {
    return document.cookie.split(';')
        .map(cookie=> cookie.trim())
        .find(row => row.startsWith("XSRF-TOKEN="))?.split("=")[1];
}

export default service