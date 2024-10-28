'use client'
import type { FC } from 'react'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Textarea from 'rc-textarea'
import Answer from './answer'
import Question from './question'
import type { FeedbackFunc } from './type'
import styles from './style.module.css'
import type { ChatItem, VisionFile, VisionSettings } from '@/types/app'
import { TransferMethod } from '@/types/app'
import Toast from '@/app/components/base/toast'
import ChatImageUploader from '@/app/components/base/image-uploader/chat-image-uploader'
import ImageList from '@/app/components/base/image-uploader/image-list'
import { useImageFiles } from '@/app/components/base/image-uploader/hooks'

export type IChatProps = {
  chatList: ChatItem[]
  /**
   * Whether to display the editing area and rating status
   */
  feedbackDisabled?: boolean
  /**
   * Whether to display the input area
   */
  isHideSendInput?: boolean
  onFeedback?: FeedbackFunc
  checkCanSend?: () => boolean
  onSend?: (message: string, files: VisionFile[]) => void
  useCurrentUserAvatar?: boolean
  isResponding?: boolean
  controlClearQuery?: number
  visionConfig?: VisionSettings
}

const Chat: FC<IChatProps> = ({
  chatList,
  feedbackDisabled = false,
  isHideSendInput = false,
  onFeedback,
  checkCanSend,
  onSend = () => { },
  useCurrentUserAvatar,
  isResponding,
  controlClearQuery,
  visionConfig,
}) => {
  const chatListRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { notify } = Toast
  const isUseInputMethod = useRef(false)

  const [query, setQuery] = React.useState('')
  const handleContentChange = (e: any) => {
    const value = e.target.value
    setQuery(value)
  }

  const logError = (message: string) => {
    notify({ type: 'error', message, duration: 3000 })
  }

  const valid = () => {
    if (!query || query.trim() === '') {
      logError('Message cannot be empty')
      return false
    }
    return true
  }

  useEffect(() => {
    if (controlClearQuery)
      setQuery('')
  }, [controlClearQuery])
  const {
    files,
    onUpload,
    onRemove,
    onReUpload,
    onImageLinkLoadError,
    onImageLinkLoadSuccess,
    onClear,
  } = useImageFiles()

  useEffect(() => {
    if (chatListRef.current)
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight
  }, [chatList, isResponding])

  const handleSend = () => {
    if (!valid() || (checkCanSend && !checkCanSend()))
      return
    onSend(query, files.filter(file => file.progress !== -1).map(fileItem => ({
      type: 'image',
      transfer_method: fileItem.type,
      url: fileItem.url,
      upload_file_id: fileItem.fileId,
    })))
    if (!files.find(item => item.type === TransferMethod.local_file && !item.fileId)) {
      if (files.length)
        onClear()
      if (!isResponding)
        setQuery('')
    }
  }

  const handleKeyUp = (e: any) => {
    if (e.code === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isUseInputMethod.current && query.trim())
        handleSend()
    }
  }

  const handleKeyDown = (e: any) => {
    isUseInputMethod.current = e.nativeEvent.isComposing
    if (e.code === 'Enter' && !e.shiftKey) {
      setQuery(query.replace(/\n$/, ''))
      e.preventDefault()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-[30px]" ref={chatListRef}>
          {chatList.map((item) => {
            if (item.isAnswer) {
              const isLast = item.id === chatList[chatList.length - 1].id
              return <Answer
                key={item.id}
                item={item}
                feedbackDisabled={feedbackDisabled}
                onFeedback={onFeedback}
                isResponding={isResponding && isLast}
              />
            }
            return (
              <Question
                key={item.id}
                id={item.id}
                content={item.content}
                useCurrentUserAvatar={useCurrentUserAvatar}
                imgSrcs={(item.message_files && item.message_files?.length > 0) ? item.message_files.map(item => item.url) : []}
              />
            )
          })}
        </div>
      </div>

      {/* 입력창 영역 */}
      {!isHideSendInput && (
        <div className="flex-shrink-0 px-4 pb-4 bg-white">
          <div className="relative bg-white rounded-2xl border border-gray-200 hover:border-gray-300 shadow-sm transition-colors">
            {visionConfig?.enabled && (
              <div className="absolute left-4 bottom-[15px] z-10">
                <ChatImageUploader
                  settings={visionConfig}
                  onUpload={onUpload}
                  disabled={files.length >= visionConfig.number_limits}
                />
              </div>
            )}

            {files.length > 0 && (
              <div className="px-4 pt-4">
                <ImageList
                  list={files}
                  onRemove={onRemove}
                  onReUpload={onReUpload}
                  onImageLinkLoadSuccess={onImageLinkLoadSuccess}
                  onImageLinkLoadError={onImageLinkLoadError}
                />
              </div>
            )}

            <div className="relative flex items-end">
              <Textarea
                className={`
                  w-full px-4 py-[14px] text-[15px] leading-[1.6] text-gray-700
                  outline-none resize-none bg-transparent
                  ${visionConfig?.enabled ? 'pl-[52px]' : ''}
                  ${files.length > 0 ? 'mt-2' : ''}
                `}
                value={query}
                onChange={handleContentChange}
                onKeyUp={handleKeyUp}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요..."
                autoSize={{ minRows: 1, maxRows: 5 }}
              />
              <div className="absolute right-2 bottom-[10px] flex items-center">
                <button
                  className={`${styles.sendBtn} w-[32px] h-[32px] rounded-lg cursor-pointer transition-all duration-200 
                    ${query.trim() ? 'opacity-100 hover:bg-blue-50' : 'opacity-50 cursor-not-allowed'}`}
                  onClick={handleSend}
                  disabled={!query.trim()}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(Chat)
