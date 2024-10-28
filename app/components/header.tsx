import type { FC } from 'react'
import React from 'react'
import {
  Bars3Icon,
  PencilSquareIcon,
} from '@heroicons/react/24/solid'
import AppIcon from '@/app/components/base/app-icon'
export type IHeaderProps = {
  title: string
  isMobile?: boolean
  onShowSideBar?: () => void
  onCreateNewChat?: () => void
}
const Header: FC<IHeaderProps> = ({
  title,
  isMobile,
  onShowSideBar,
  onCreateNewChat,
}) => {
  return (
    <div className="shrink-0 flex items-center justify-between h-14 px-4 bg-gradient-to-b from-white to-gray-50 border-b border-gray-200 text-gray-900">
      {isMobile
        ? (
          <div
            className='flex items-center justify-center h-10 w-10 cursor-pointer hover:bg-gray-100 rounded-lg'
            onClick={() => onShowSideBar?.()}
          >
            <Bars3Icon className="h-5 w-5" />
          </div>
        )
        : <div></div>}

      <div className='flex items-center space-x-3'>
        <AppIcon size="small" className="bg-primary-50 text-primary-500" />
        <div className="text-base font-bold">{title}</div>
      </div>

      {isMobile
        ? (
          <div className='flex items-center justify-center h-10 w-10 cursor-pointer hover:bg-gray-100 rounded-lg'
            onClick={() => onCreateNewChat?.()}
          >
            <PencilSquareIcon className="h-5 w-5" />
          </div>
        )
        : <div></div>}
    </div>
  )
}

export default React.memo(Header)
