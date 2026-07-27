import React, { useRef, useEffect, useState, useCallback } from 'react'

const GRAVITY = 0.85
const GROUND_HEIGHT = 80
const PLAYER_SIZE = 30
const OBSTACLE_WIDTH = 40
const LANDING_WINDOW = 800 // ms
const MIN_JUMP_POWER = 14
const MAX_JUMP_POWER = 22
const MIN_JUMP_ANGLE = 80  // degrees
const MAX_JUMP_ANGLE = 88  // degrees
const BASE_SCROLL_SPEED = 2.5
const DOUBLE_JUMP_POWER = 14
const MAX_AIR_JUMPS = 2
const POINTS_PER_LEVEL = 5
const TOTAL_LEVELS = 21

// ROYGBIV colors for each level within an act
const ROYGBIV = [
  '#FF0000', // Red
  '#FF7F00', // Orange
  '#FFFF00', // Yellow
  '#00FF00', // Green
  '#0000FF', // Blue
  '#4B0082', // Indigo
  '#8B00FF', // Violet
]

// Cave background tints per act
const ACT_BACKGROUNDS = [
  ['#1a1a2e', '#16213e', '#0f3460'], // Act 1 - deep blue cave
  ['#2e1a1a', '#3e1621', '#601a0f'], // Act 2 - deep red cave
  ['#1a2e1a', '#163e21', '#0f6034'], // Act 3 - deep green cave
]

function getLevel(score) {
  return Math.min(Math.floor(score / POINTS_PER_LEVEL), TOTAL_LEVELS - 1)
}

function getAct(level) {
  return Math.floor(level / 7)
}

function getLevelInAct(level) {
  return level % 7
}

function getCrystalColor(level) {
  return ROYGBIV[getLevelInAct(level)]
}

// Difficulty scales with act
function getLevelDifficulty(level) {
  const act = getAct(level)
  const t = act / 2 // 0, 0.5, 1
  return {
    gapMin: 220 - act * 20,
    gapMax: 320 - act * 30,
    spacingMin: 300 - act * 30,
    spacingMax: 500 - act * 50,
    scrollSpeed: BASE_SCROLL_SPEED + act * 0.3,
  }
}

// Seeded random for deterministic crystal placement per chunk
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [screen, setScreen] = useState('menu') // menu | playing | dead
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('jj_highscore') || '0', 10)
  })

  const initGame = useCallback(() => {
    const canvas = canvasRef.current
    const groundY = canvas.height - GROUND_HEIGHT

    gameRef.current = {
      player: {
        x: 120,
        y: groundY - PLAYER_SIZE,
        vy: 0,
        vx: 0,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        isGrounded: true,
        landingTime: performance.now(),
        squash: 0,
        airJumpsLeft: MAX_AIR_JUMPS,
      },
      obstacles: [],
      scrollX: 0,
      nextObstacleX: 600,
      score: 0,
      groundY,
      particles: [],
      level: 0,
      lastLevel: -1,
    }
  }, [])

  const handleTap = useCallback(() => {
    if (screen === 'menu') {
      initGame()
      setScore(0)
      setScreen('playing')
      return
    }

    if (screen === 'dead') {
      initGame()
      setScore(0)
      setScreen('playing')
      return
    }

    const game = gameRef.current
    if (!game) return
    const player = game.player

    if (player.isGrounded && player.landingTime !== null) {
      const elapsed = performance.now() - player.landingTime
      const timing = Math.min(elapsed / LANDING_WINDOW, 1)

      const power = MAX_JUMP_POWER - timing * (MAX_JUMP_POWER - MIN_JUMP_POWER)
      const angleDeg = MAX_JUMP_ANGLE - timing * (MAX_JUMP_ANGLE - MIN_JUMP_ANGLE)
      const angleRad = (angleDeg * Math.PI) / 180

      player.vy = -Math.sin(angleRad) * power
      player.vx = 0
      player.isGrounded = false
      player.landingTime = null
      player.squash = 0
      player.airJumpsLeft = MAX_AIR_JUMPS

      for (let i = 0; i < 6; i++) {
        game.particles.push({
          x: player.x + player.width / 2,
          y: game.groundY,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 4,
          life: 1,
        })
      }
    } else if (!player.isGrounded && player.airJumpsLeft > 0) {
      player.vy = -DOUBLE_JUMP_POWER
      player.vx = 0
      player.airJumpsLeft--

      for (let i = 0; i < 4; i++) {
        game.particles.push({
          x: player.x + player.width / 2,
          y: player.y + player.height,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 3,
          life: 0.8,
        })
      }
    }
  }, [screen, initGame])

  useEffect(() => {
    const canvas = canvasRef.current
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      if (gameRef.current) {
        gameRef.current.groundY = canvas.height - GROUND_HEIGHT
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const handlePointerDown = (e) => {
      e.preventDefault()
      handleTap()
    }
    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false })

    return () => {
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [handleTap])

  useEffect(() => {
    if (screen !== 'playing') return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    // Draw a crystal shape
    const drawCrystal = (x, y, size, color, alpha) => {
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(x, y - size)
      ctx.lineTo(x + size * 0.4, y - size * 0.3)
      ctx.lineTo(x + size * 0.3, y + size * 0.5)
      ctx.lineTo(x, y + size)
      ctx.lineTo(x - size * 0.3, y + size * 0.5)
      ctx.lineTo(x - size * 0.4, y - size * 0.3)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      // Inner highlight
      ctx.beginPath()
      ctx.moveTo(x, y - size * 0.7)
      ctx.lineTo(x + size * 0.15, y - size * 0.1)
      ctx.lineTo(x, y + size * 0.4)
      ctx.lineTo(x - size * 0.15, y - size * 0.1)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = alpha * 0.25
      ctx.fill()
      ctx.globalAlpha = 1
    }

    const loop = () => {
      const game = gameRef.current
      if (!game) return

      const { player, obstacles, particles } = game
      const groundY = canvas.height - GROUND_HEIGHT

      game.groundY = groundY

      // Update level
      game.level = getLevel(game.score)
      const difficulty = getLevelDifficulty(game.level)
      const crystalColor = getCrystalColor(game.level)
      const act = getAct(game.level)
      const bg = ACT_BACKGROUNDS[act]

      // --- Update ---
      game.scrollX += difficulty.scrollSpeed

      // Player physics
      if (!player.isGrounded) {
        player.vy += GRAVITY
        player.x += player.vx
        player.y += player.vy

        player.vx *= 0.99

        if (player.y >= groundY - player.height) {
          player.y = groundY - player.height
          player.vy = 0
          player.vx = 0
          player.isGrounded = true
          player.landingTime = performance.now()
          player.squash = 1

          game.score++
          setScore(game.score)
        }
      } else {
        player.x += (120 - player.x) * 0.1

        if (player.squash > 0) {
          player.squash *= 0.85
          if (player.squash < 0.01) player.squash = 0
        }

        if (player.landingTime !== null) {
          const elapsed = performance.now() - player.landingTime
          if (elapsed > LANDING_WINDOW) {
            player.vy = -MIN_JUMP_POWER
            player.vx = 0
            player.isGrounded = false
            player.landingTime = null
          }
        }
      }

      // Die if scrolled off left
      if (player.x + player.width < 0) {
        if (game.score > highScore) {
          const newHigh = game.score
          setHighScore(newHigh)
          localStorage.setItem('jj_highscore', newHigh.toString())
        }
        setScreen('dead')
        return
      }

      // Spawn obstacles with level-appropriate difficulty
      while (game.nextObstacleX - game.scrollX < canvas.width + 200) {
        const gapSize = difficulty.gapMin + Math.random() * (difficulty.gapMax - difficulty.gapMin)
        const gapY = 100 + Math.random() * (groundY - gapSize - 150)

        obstacles.push({
          x: game.nextObstacleX,
          gapY,
          gapSize,
          passed: false,
        })

        game.nextObstacleX += difficulty.spacingMin + Math.random() * (difficulty.spacingMax - difficulty.spacingMin)
      }

      // Collision detection
      const px = player.x
      const py = player.y
      const pw = player.width
      const ph = player.height

      for (const obs of obstacles) {
        const ox = obs.x - game.scrollX
        if (ox > px + pw || ox + OBSTACLE_WIDTH < px) continue

        if (py < obs.gapY) {
          if (game.score > highScore) {
            const newHigh = game.score
            setHighScore(newHigh)
            localStorage.setItem('jj_highscore', newHigh.toString())
          }
          setScreen('dead')
          return
        }
        if (py + ph > obs.gapY + obs.gapSize) {
          if (game.score > highScore) {
            const newHigh = game.score
            setHighScore(newHigh)
            localStorage.setItem('jj_highscore', newHigh.toString())
          }
          setScreen('dead')
          return
        }
      }

      // Remove off-screen obstacles
      while (obstacles.length > 0 && obstacles[0].x - game.scrollX < -OBSTACLE_WIDTH - 50) {
        obstacles.shift()
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.15
        p.life -= 0.03
        if (p.life <= 0) particles.splice(i, 1)
      }

      // --- Draw ---
      // Cave background (changes per act)
      const caveBg = ctx.createLinearGradient(0, 0, 0, canvas.height)
      caveBg.addColorStop(0, bg[0])
      caveBg.addColorStop(0.5, bg[1])
      caveBg.addColorStop(1, bg[2])
      ctx.fillStyle = caveBg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Background crystals (parallax, seeded per 400px chunk)
      const chunkWidth = 400
      const parallax = game.scrollX * 0.3
      const startChunk = Math.floor((parallax - 100) / chunkWidth)
      const endChunk = Math.floor((parallax + canvas.width + 100) / chunkWidth)

      for (let chunk = startChunk; chunk <= endChunk; chunk++) {
        const rng = seededRandom(chunk * 7919 + 1)
        const crystalCount = 3 + Math.floor(rng() * 4)
        for (let i = 0; i < crystalCount; i++) {
          const cx = chunk * chunkWidth + rng() * chunkWidth - parallax
          const onCeiling = rng() > 0.5
          const cy = onCeiling
            ? 10 + rng() * 60
            : groundY - 10 - rng() * 60
          const size = 8 + rng() * 18
          const alpha = 0.15 + rng() * 0.25
          drawCrystal(cx, cy, size, crystalColor, alpha)
        }
      }

      // Ground (rocky cave floor)
      ctx.fillStyle = '#4a3728'
      ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT)
      ctx.fillStyle = '#5d4a3a'
      ctx.fillRect(0, groundY, canvas.width, 4)

      // Ceiling
      ctx.fillStyle = '#3a2a1a'
      ctx.fillRect(0, 0, canvas.width, 6)

      // Obstacles (stalactites & stalagmites)
      for (const obs of obstacles) {
        const ox = obs.x - game.scrollX
        if (ox > canvas.width + 50 || ox + OBSTACLE_WIDTH < -50) continue
        const cx = ox + OBSTACLE_WIDTH / 2

        // Stalactite (top)
        ctx.beginPath()
        ctx.moveTo(ox - 10, 0)
        ctx.lineTo(ox + OBSTACLE_WIDTH + 10, 0)
        ctx.lineTo(ox + OBSTACLE_WIDTH + 6, obs.gapY * 0.3)
        ctx.lineTo(ox + OBSTACLE_WIDTH, obs.gapY * 0.6)
        ctx.lineTo(cx + 4, obs.gapY - 6)
        ctx.lineTo(cx, obs.gapY)
        ctx.lineTo(cx - 4, obs.gapY - 6)
        ctx.lineTo(ox, obs.gapY * 0.6)
        ctx.lineTo(ox - 6, obs.gapY * 0.3)
        ctx.closePath()
        ctx.fillStyle = '#6b5b4f'
        ctx.fill()

        // Stalagmite (bottom)
        const botTop = obs.gapY + obs.gapSize
        const botH = groundY - botTop
        ctx.beginPath()
        ctx.moveTo(ox - 10, groundY)
        ctx.lineTo(ox + OBSTACLE_WIDTH + 10, groundY)
        ctx.lineTo(ox + OBSTACLE_WIDTH + 6, groundY - botH * 0.3)
        ctx.lineTo(ox + OBSTACLE_WIDTH, groundY - botH * 0.6)
        ctx.lineTo(cx + 4, botTop + 6)
        ctx.lineTo(cx, botTop)
        ctx.lineTo(cx - 4, botTop + 6)
        ctx.lineTo(ox, groundY - botH * 0.6)
        ctx.lineTo(ox - 6, groundY - botH * 0.3)
        ctx.closePath()
        ctx.fillStyle = '#7a6a5e'
        ctx.fill()
      }

      // Player
      ctx.save()
      ctx.translate(player.x + player.width / 2, player.y + player.height)
      const sq = player.squash
      ctx.scale(1 + sq * 0.3, 1 - sq * 0.3)

      ctx.fillStyle = '#FFD600'
      ctx.fillRect(-player.width / 2, -player.height, player.width, player.height)

      ctx.fillStyle = '#000'
      ctx.fillRect(-player.width / 4 - 2, -player.height + 6, 5, 6)
      ctx.fillRect(player.width / 4 - 3, -player.height + 6, 5, 6)

      ctx.fillStyle = '#E65100'
      ctx.fillRect(-4, -player.height + 18, 8, 4)

      ctx.restore()

      // Landing window indicator
      if (player.isGrounded && player.landingTime !== null) {
        const elapsed = performance.now() - player.landingTime
        const remaining = 1 - elapsed / LANDING_WINDOW
        if (remaining > 0) {
          ctx.fillStyle = `rgba(255, 255, 0, ${remaining * 0.8})`
          ctx.fillRect(player.x - 2, groundY + 5, (player.width + 4) * remaining, 6)
        }
      }

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = p.life
        ctx.fillStyle = crystalColor
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      }
      ctx.globalAlpha = 1

      // HUD - Level & Score
      const levelInAct = getLevelInAct(game.level) + 1
      const actNum = act + 1
      const levelLabel = actNum <= 3 ? `${actNum}-${levelInAct}` : 'MAX'

      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 4
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.strokeText(game.score.toString(), canvas.width / 2, 60)
      ctx.fillText(game.score.toString(), canvas.width / 2, 60)

      ctx.font = 'bold 20px sans-serif'
      ctx.fillStyle = crystalColor
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 3
      ctx.strokeText(`ACT ${actNum} - LEVEL ${levelInAct}`, canvas.width / 2, 90)
      ctx.fillText(`ACT ${actNum} - LEVEL ${levelInAct}`, canvas.width / 2, 90)

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [screen, highScore])

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }} />

      {screen === 'menu' && (
        <div style={overlayStyle} onPointerDown={handleTap}>
          <div style={{ fontSize: 42, fontWeight: 'bold', color: '#FFD600', textShadow: '3px 3px 0 #E65100' }}>
            JUMPING
          </div>
          <div style={{ fontSize: 52, fontWeight: 'bold', color: '#FFD600', textShadow: '3px 3px 0 #E65100', marginBottom: 30 }}>
            JEHOSAPHAT
          </div>
          <div style={{ fontSize: 18, color: '#fff', marginBottom: 10 }}>
            Tap when you land to jump!
          </div>
          <div style={{ fontSize: 14, color: '#ccc', marginBottom: 30 }}>
            Early tap = big jump &bull; Late tap = small jump &bull; Triple jump!
          </div>
          <div style={buttonStyle}>TAP TO START</div>
          {highScore > 0 && (
            <div style={{ fontSize: 16, color: '#FFD600', marginTop: 20 }}>
              BEST: {highScore}
            </div>
          )}
        </div>
      )}

      {screen === 'dead' && (
        <div style={overlayStyle} onPointerDown={handleTap}>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#FF5722', marginBottom: 20 }}>
            GAME OVER
          </div>
          <div style={{ fontSize: 64, fontWeight: 'bold', color: '#fff', marginBottom: 10 }}>
            {score}
          </div>
          <div style={{ fontSize: 18, color: '#FFD600', marginBottom: 30 }}>
            BEST: {highScore}
          </div>
          <div style={buttonStyle}>TAP TO RETRY</div>
        </div>
      )}
    </>
  )
}

const overlayStyle = {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)',
  zIndex: 10,
  userSelect: 'none',
}

const buttonStyle = {
  fontSize: 20,
  fontWeight: 'bold',
  color: '#fff',
  background: '#FF5722',
  padding: '14px 40px',
  borderRadius: 8,
  cursor: 'pointer',
}

export default App
