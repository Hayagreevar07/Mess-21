import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Trophy, RefreshCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

interface SnakeGameProps {
  targetScore?: number
  onWin?: () => void
  isOfflineMode?: boolean
}

type Point = { x: number; y: number }

const GRID_SIZE = 20
const CELL_SIZE = 15
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }]
const INITIAL_DIRECTION = { x: 0, y: -1 }

export default function SnakeGame({ targetScore, onWin, isOfflineMode }: SnakeGameProps) {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE)
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION)
  const [food, setFood] = useState<Point>({ x: 5, y: 5 })
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [hasWon, setHasWon] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number | undefined>(undefined)
  const lastUpdateTimeRef = useRef<number>(0)

  const generateFood = useCallback((currentSnake: Point[]) => {
    let newFood: Point
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      }
      if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break
      }
    }
    return newFood
  }, [])

  const resetGame = () => {
    setSnake(INITIAL_SNAKE)
    setDirection(INITIAL_DIRECTION)
    setFood(generateFood(INITIAL_SNAKE))
    setScore(0)
    setGameOver(false)
    setHasWon(false)
    lastUpdateTimeRef.current = 0
  }

  const checkCollision = (head: Point, currentSnake: Point[]) => {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true
    }
    for (let i = 0; i < currentSnake.length; i++) {
      if (head.x === currentSnake[i].x && head.y === currentSnake[i].y) {
        return true
      }
    }
    return false
  }

  const update = useCallback((time: number) => {
    if (gameOver || hasWon) return

    if (time - lastUpdateTimeRef.current > 150) { // 150ms per frame
      setSnake(prevSnake => {
        const newHead = { x: prevSnake[0].x + direction.x, y: prevSnake[0].y + direction.y }
        
        if (checkCollision(newHead, prevSnake)) {
          setGameOver(true)
          return prevSnake
        }

        const newSnake = [newHead, ...prevSnake]
        
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => {
            const newScore = s + 1
            if (targetScore && newScore >= targetScore && !isOfflineMode) {
              setHasWon(true)
              if (onWin) onWin()
            }
            return newScore
          })
          setFood(generateFood(newSnake))
        } else {
          newSnake.pop()
        }
        
        return newSnake
      })
      lastUpdateTimeRef.current = time
    }
    requestRef.current = requestAnimationFrame(update)
  }, [direction, food, gameOver, hasWon, targetScore, isOfflineMode, onWin, generateFood])

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update)
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
    }
  }, [update])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          if (direction.y !== 1) setDirection({ x: 0, y: -1 })
          break
        case 'ArrowDown':
          if (direction.y !== -1) setDirection({ x: 0, y: 1 })
          break
        case 'ArrowLeft':
          if (direction.x !== 1) setDirection({ x: -1, y: 0 })
          break
        case 'ArrowRight':
          if (direction.x !== -1) setDirection({ x: 1, y: 0 })
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [direction])

  // D-pad controls for explicit button taps
  const handleDirection = (newDir: Point) => {
    if (newDir.x !== 0 && direction.x !== -newDir.x) setDirection(newDir)
    if (newDir.y !== 0 && direction.y !== -newDir.y) setDirection(newDir)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#111827' // gray-900
    ctx.fillRect(0, 0, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE)

    // Draw food
    ctx.fillStyle = '#ef4444' // red-500
    ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)

    // Draw snake
    ctx.fillStyle = '#10b981' // emerald-500
    snake.forEach((segment) => {
      ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      // Slight border for segments
      ctx.strokeStyle = '#065f46' // emerald-800
      ctx.strokeRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    })
  }, [snake, food])

  // Common button style for D-Pad
  const dpadBtnStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-strong)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    cursor: 'pointer',
    touchAction: 'manipulation'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px' }}>
      {isOfflineMode && <h2 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Offline Mode</h2>}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '300px', marginBottom: '16px' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Score: {score}</span>
        {targetScore && !isOfflineMode && (
          <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Target: {targetScore}</span>
        )}
      </div>
      
      <div style={{ position: 'relative', width: '100%', maxWidth: '300px', aspectRatio: '1/1' }}>
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          style={{ 
            width: '100%',
            height: '100%',
            border: '2px solid var(--border)', 
            borderRadius: '8px', 
            background: '#111827',
            touchAction: 'none'
          }}
        />
        
        {gameOver && !hasWon && (
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', 
            justifyContent: 'center', alignItems: 'center', borderRadius: '8px', zIndex: 10
          }}>
            <h3 style={{ color: 'var(--danger)', fontSize: '1.5rem', marginBottom: '16px' }}>Game Over</h3>
            <button className="btn btn-primary" onClick={resetGame}>
              <RefreshCcw size={16} /> Try Again
            </button>
          </div>
        )}

        {hasWon && (
          <div style={{ 
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', 
            justifyContent: 'center', alignItems: 'center', borderRadius: '8px', zIndex: 10
          }}>
            <Trophy size={48} color="var(--warning)" style={{ marginBottom: '16px' }} />
            <h3 style={{ color: 'var(--success)', fontSize: '1.5rem', marginBottom: '16px' }}>Alarm Stopped!</h3>
          </div>
        )}
      </div>

      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <button style={dpadBtnStyle} onClick={() => handleDirection({ x: 0, y: -1 })}>
          <ArrowUp size={28} />
        </button>
        <div style={{ display: 'flex', gap: '48px' }}>
          <button style={dpadBtnStyle} onClick={() => handleDirection({ x: -1, y: 0 })}>
            <ArrowLeft size={28} />
          </button>
          <button style={dpadBtnStyle} onClick={() => handleDirection({ x: 1, y: 0 })}>
            <ArrowRight size={28} />
          </button>
        </div>
        <button style={dpadBtnStyle} onClick={() => handleDirection({ x: 0, y: 1 })}>
          <ArrowDown size={28} />
        </button>
      </div>

      <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        Use the on-screen buttons or arrow keys to move.
        {targetScore && !isOfflineMode && <p>Reach score {targetScore} to dismiss the alarm.</p>}
      </div>
    </div>
  )
}
