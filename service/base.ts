import { API_PREFIX } from '@/config'
import Toast from '@/app/components/base/toast'
import type { AnnotationReply, MessageEnd, MessageReplace, ThoughtItem } from '@/app/components/chat/type'
import type { VisionFile } from '@/types/app'

const TIME_OUT = 180000 // 3분으로 조정 (Vercel 제한 고려)

const ContentType = {
  json: 'application/json',
  stream: 'text/event-stream',
  form: 'application/x-www-form-urlencoded; charset=UTF-8',
  download: 'application/octet-stream', // for download
}

const baseOptions = {
  method: 'GET',
  mode: 'cors',
  credentials: 'include',
  headers: new Headers({
    'Content-Type': ContentType.json,
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=180', // 3분
  }),
  redirect: 'follow',
  timeout: TIME_OUT,
}

// 타임아웃 에러 핸들링 추가
const handleRequestTimeout = (error: any) => {
  if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
    Toast.error('응답 시간이 초과되었습니다. 다시 시도해주세요.')
    return null
  }
  throw error
}

export type WorkflowStartedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    sequence_number: number
    created_at: number
  }
}

export type WorkflowFinishedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: any
    error: string
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}

export type NodeStartedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    created_at: number
    extras?: any
  }
}

export type NodeFinishedResponse = {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    process_data: any
    outputs: any
    status: string
    error: string
    elapsed_time: number
    execution_metadata: {
      total_tokens: number
      total_price: number
      currency: string
    }
    created_at: number
  }
}

export type IOnDataMoreInfo = {
  conversationId?: string
  taskId?: string
  messageId: string
  errorMessage?: string
  errorCode?: string
}

export type IOnData = (message: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => void
export type IOnThought = (though: ThoughtItem) => void
export type IOnFile = (file: VisionFile) => void
export type IOnMessageEnd = (messageEnd: MessageEnd) => void
export type IOnMessageReplace = (messageReplace: MessageReplace) => void
export type IOnAnnotationReply = (messageReplace: AnnotationReply) => void
export type IOnCompleted = (hasError?: boolean) => void
export type IOnError = (msg: string, code?: string) => void
export type IOnWorkflowStarted = (workflowStarted: WorkflowStartedResponse) => void
export type IOnWorkflowFinished = (workflowFinished: WorkflowFinishedResponse) => void
export type IOnNodeStarted = (nodeStarted: NodeStartedResponse) => void
export type IOnNodeFinished = (nodeFinished: NodeFinishedResponse) => void

type IOtherOptions = {
  isPublicAPI?: boolean
  bodyStringify?: boolean
  needAllResponseContent?: boolean
  deleteContentType?: boolean
  onData?: IOnData // for stream
  onThought?: IOnThought
  onFile?: IOnFile
  onMessageEnd?: IOnMessageEnd
  onMessageReplace?: IOnMessageReplace
  onError?: IOnError
  onCompleted?: IOnCompleted // for stream
  getAbortController?: (abortController: AbortController) => void
  onWorkflowStarted?: IOnWorkflowStarted
  onWorkflowFinished?: IOnWorkflowFinished
  onNodeStarted?: IOnNodeStarted
  onNodeFinished?: IOnNodeFinished
}

function unicodeToChar(text: string) {
  return text.replace(/\\u[0-9a-f]{4}/g, (_match, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  })
}

const handleStream = async (
  response: Response,
  onData: IOnData,
  onCompleted?: IOnCompleted,
  onThought?: IOnThought,
  onMessageEnd?: IOnMessageEnd,
  onMessageReplace?: IOnMessageReplace,
  onFile?: IOnFile,
  onWorkflowStarted?: IOnWorkflowStarted,
  onWorkflowFinished?: IOnWorkflowFinished,
  onNodeStarted?: IOnNodeStarted,
  onNodeFinished?: IOnNodeFinished,
) => {
  if (!response.ok)
    throw new Error('Network response was not ok')

  const reader = response.body?.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let bufferObj: Record<string, any>
  let isFirstMessage = true
  let timeoutId: NodeJS.Timeout

  const resetTimeout = () => {
    if (timeoutId)
      clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      onData('', false, {
        conversationId: undefined,
        messageId: '',
        errorMessage: '응답 시간 초과',
      })
      onCompleted?.(true)
    }, TIME_OUT)
  }

  try {
    while (true) {
      resetTimeout()
      const { done, value } = await reader!.read()

      if (done) {
        if (timeoutId)
          clearTimeout(timeoutId)
        onCompleted?.()
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      for (const message of lines) {
        if (!message.startsWith('data: '))
          continue

        try {
          bufferObj = JSON.parse(message.substring(6))

          if (bufferObj.status === 400 || !bufferObj.event) {
            onData('', false, {
              conversationId: undefined,
              messageId: '',
              errorMessage: bufferObj?.message,
              errorCode: bufferObj?.code,
            })
            onCompleted?.(true)
            return
          }

          switch (bufferObj.event) {
            case 'message':
            case 'agent_message':
              onData(unicodeToChar(bufferObj.answer), isFirstMessage, {
                conversationId: bufferObj.conversation_id,
                taskId: bufferObj.task_id,
                messageId: bufferObj.id,
              })
              isFirstMessage = false
              break
            case 'agent_thought':
              onThought?.(bufferObj as ThoughtItem)
              break
            case 'message_end':
              onMessageEnd?.(bufferObj as MessageEnd)
              break
            case 'message_replace':
              onMessageReplace?.(bufferObj as MessageReplace)
              break
            case 'workflow_started':
              onWorkflowStarted?.(bufferObj as WorkflowStartedResponse)
              break
            case 'workflow_finished':
              onWorkflowFinished?.(bufferObj as WorkflowFinishedResponse)
              break
          }
        }
        catch (e) {
          console.error('Message processing error:', e)
        }
      }
      buffer = lines[lines.length - 1]
    }
  }
  catch (error) {
    console.error('Stream processing error:', error)
    onData('', false, {
      conversationId: undefined,
      messageId: '',
      errorMessage: `${error}`,
    })
    onCompleted?.(true)
  }
}

const baseFetch = (url: string, fetchOptions: any, { needAllResponseContent }: IOtherOptions) => {
  const options = Object.assign({}, baseOptions, fetchOptions)

  const urlPrefix = API_PREFIX

  let urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  const { method, params, body } = options
  // handle query
  if (method === 'GET' && params) {
    const paramsArray: string[] = []
    Object.keys(params).forEach(key =>
      paramsArray.push(`${key}=${encodeURIComponent(params[key])}`),
    )
    if (urlWithPrefix.search(/\?/) === -1)
      urlWithPrefix += `?${paramsArray.join('&')}`

    else
      urlWithPrefix += `&${paramsArray.join('&')}`

    delete options.params
  }

  if (body)
    options.body = JSON.stringify(body)

  // Handle timeout
  return Promise.race([
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('request timeout'))
      }, TIME_OUT)
    }),
    new Promise((resolve, reject) => {
      globalThis.fetch(urlWithPrefix, options)
        .then((res: any) => {
          const resClone = res.clone()
          // Error handler
          if (!/^(2|3)\d{2}$/.test(res.status)) {
            try {
              const bodyJson = res.json()
              switch (res.status) {
                case 401: {
                  Toast.notify({ type: 'error', message: 'Invalid token' })
                  return
                }
                default:
                  // eslint-disable-next-line no-new
                  new Promise(() => {
                    bodyJson.then((data: any) => {
                      Toast.notify({ type: 'error', message: data.message })
                    })
                  })
              }
            }
            catch (e) {
              Toast.notify({ type: 'error', message: `${e}` })
            }

            return Promise.reject(resClone)
          }

          // handle delete api. Delete api not return content.
          if (res.status === 204) {
            resolve({ result: 'success' })
            return
          }

          // return data
          const data = options.headers.get('Content-type') === ContentType.download ? res.blob() : res.json()

          resolve(needAllResponseContent ? resClone : data)
        })
        .catch((err) => {
          Toast.notify({ type: 'error', message: err })
          reject(err)
        })
    }),
  ])
}

export const upload = (fetchOptions: any): Promise<any> => {
  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}/file-upload`
  const defaultOptions = {
    method: 'POST',
    url: `${urlWithPrefix}`,
    data: {},
  }
  const options = {
    ...defaultOptions,
    ...fetchOptions,
  }
  return new Promise((resolve, reject) => {
    const xhr = options.xhr
    xhr.open(options.method, options.url)
    for (const key in options.headers)
      xhr.setRequestHeader(key, options.headers[key])

    xhr.withCredentials = true
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200)
          resolve({ id: xhr.response })
        else
          reject(xhr)
      }
    }
    xhr.upload.onprogress = options.onprogress
    xhr.send(options.data)
  })
}

export const ssePost = (
  url: string,
  fetchOptions: any,
  {
    onData,
    onCompleted,
    onThought,
    onFile,
    onMessageEnd,
    onMessageReplace,
    onWorkflowStarted,
    onWorkflowFinished,
    onNodeStarted,
    onNodeFinished,
    onError,
  }: IOtherOptions,
) => {
  const options = Object.assign({}, baseOptions, {
    method: 'POST',
  }, fetchOptions)

  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  const { body } = options
  if (body)
    options.body = JSON.stringify(body)

  globalThis.fetch(urlWithPrefix, options)
    .then((res: any) => {
      if (!/^(2|3)\d{2}$/.test(res.status)) {
        // eslint-disable-next-line no-new
        new Promise(() => {
          res.json().then((data: any) => {
            Toast.notify({ type: 'error', message: data.message || 'Server Error' })
          })
        })
        onError?.('Server Error')
        return
      }
      return handleStream(res, (str: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => {
        if (moreInfo.errorMessage) {
          Toast.notify({ type: 'error', message: moreInfo.errorMessage })
          return
        }
        onData?.(str, isFirstMessage, moreInfo)
      }, () => {
        onCompleted?.()
      }, onThought, onMessageEnd, onMessageReplace, onFile, onWorkflowStarted, onWorkflowFinished, onNodeStarted, onNodeFinished)
    }).catch((e) => {
      Toast.notify({ type: 'error', message: e })
      onError?.(e)
    })
}

export const request = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return baseFetch(url, options, otherOptions || {})
}

export const get = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'GET' }), otherOptions)
}

export const post = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'POST' }), otherOptions)
}

export const put = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'PUT' }), otherOptions)
}

export const del = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'DELETE' }), otherOptions)
}
