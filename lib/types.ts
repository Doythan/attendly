export type Plan = 'FREE' | 'PRO'
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'
export type MessageType = 'ATTENDANCE' | 'PAYMENT' | 'NOTICE'
export type MessageTone = 'FRIENDLY' | 'FORMAL' | 'FIRM'
export type MessageStatus = 'DRAFT' | 'SENT' | 'FAILED'

export interface Profile {
  id: string
  plan: Plan
  academy_name: string
  sms_sent_count: number
  sms_sent_count_month: string
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  owner_id: string
  name: string
  parent_phone: string
  class_name: string
  memo: string
  is_unpaid: boolean
  unpaid_months: number
  monthly_fee: number
  created_at: string
  updated_at: string
}

export interface AttendanceRecord {
  id: string
  owner_id: string
  student_id: string
  date: string
  status: AttendanceStatus
  created_at: string
  student?: Student
}

export interface Message {
  id: string
  owner_id: string
  student_id: string | null
  type: MessageType
  tone: MessageTone
  content: string
  status: MessageStatus
  provider_message_id: string | null
  error: string | null
  created_at: string
  updated_at: string
  student?: Student
}
