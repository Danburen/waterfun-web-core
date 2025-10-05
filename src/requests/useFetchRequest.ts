import type {UseFetchOptions} from "nuxt/app";
import defu from "defu";

export const useApiFetch = <T>(
    url: string,
    optionals: UseFetchOptions<T> ={}
) =>{
    const config = useRuntimeConfig();
    const csrfToken = useCookie('XSRF-TOKEN');

    const defaults: UseFetchOptions<T> = {
        baseURL: config.public.baseURL as string,
        credentials: 'include',
        server: true,
        immediate: true,
        onRequest({options}){
            if (options.method !== 'GET' && csrfToken.value) {
                const headers = new Headers(options.headers)
                headers.set('X-XSRF-TOKEN', csrfToken.value)
                options.headers = headers
            }
            // if(options.method == 'GET'){
            //     //Random query arguments
            //     options.query = {
            //         ...options.query,
            //         _t: Date.now(),
            //         _n: Math.random().toString(36).slice(2)
            //     }
            // }
        },
        onRequestError({ error }) {
            console.error('Request error:', error)
        },
        onResponse({ response }) {
            if (response.status !== 200 && response._data?.message) {
                throw createError({
                    statusCode: response.status,
                    statusMessage: response._data.message
                })
            }
        },
        onResponseError({ response }) {
            if (response) {
                const status = response._data?.status;
                const data = response._data;

                switch (status) {
                    case 401:
                        navigateTo('/login')
                        break
                    case 403:
                        throw createError({
                            statusCode: 403,
                            statusMessage: 'Forbidden',
                            data
                        })
                    default:
                        throw createError({
                            statusCode: status,
                            statusMessage: data?.message || 'HTTP Error',
                            data
                        })
                }
            } else {
                throw createError({
                    statusCode: 500,
                    statusMessage: 'Network Error'
                })
            }
        }
    }
    const params = defu(optionals, defaults)
    return useFetch(url, params)
}