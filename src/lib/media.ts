import { supabase } from './supabase'

export const uploadMedia = async (file: File | Blob, path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from('chat_media')
      .upload(path, file, { upsert: false })
      
    if (error) {
      console.error('Error uploading media:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('chat_media')
      .getPublicUrl(data.path)
      
    return urlData.publicUrl
  } catch (err) {
    console.error('Upload failed', err)
    return null
  }
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new MediaRecorder(stream)
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start()
      return true
    } catch (err) {
      console.error('Microphone access denied', err)
      return false
    }
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        
        // Stop all tracks to release microphone
        this.mediaRecorder?.stream.getTracks().forEach(track => track.stop())
        this.mediaRecorder = null
        
        resolve(audioBlob)
      }

      this.mediaRecorder.stop()
    })
  }
}
