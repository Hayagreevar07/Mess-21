import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.98,
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  out: {
    opacity: 0,
    y: -10,
    scale: 0.98,
  },
}

const pageTransition: any = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
}

interface Props {
  children: ReactNode
}

export default function PageTransition({ children }: Props) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  )
}
