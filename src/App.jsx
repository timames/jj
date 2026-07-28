import React, { useRef, useEffect, useState, useCallback } from 'react'

const GRAVITY = 0.85
const GROUND_HEIGHT = 80
const PLAYER_SIZE = 30
const OBSTACLE_WIDTH = 40
const LANDING_WINDOW = 800
const MIN_JUMP_POWER = 14
const MAX_JUMP_POWER = 22
const MIN_JUMP_ANGLE = 80
const MAX_JUMP_ANGLE = 88
const BASE_SCROLL_SPEED = 2.5
const DOUBLE_JUMP_POWER = 14
const MAX_AIR_JUMPS = 2
const POINTS_PER_CHAPTER = 5
const CHAPTERS_PER_SCENE = 7
const SCENES_PER_ACT = 7
const ACTS = 7
const TOTAL_CHAPTERS = ACTS * SCENES_PER_ACT * CHAPTERS_PER_SCENE // 343

// 7 scene themes with unique visuals
const SCENE_THEMES = [
  { name: 'Crystal Cave', bg: ['#1a1a2e', '#16213e', '#0f3460'], ground: '#4a3728', groundTop: '#5d4a3a', obstacle: '#6b5b4f', obstacleBot: '#7a6a5e' },
  { name: 'Underwater',   bg: ['#0a2a3a', '#0d3d5c', '#104e7a'], ground: '#2a4a3a', groundTop: '#3a6a5a', obstacle: '#3a6a7a', obstacleBot: '#4a7a8a' },
  { name: 'Mushroom Grove',bg: ['#2a1a2e', '#3e1640', '#5a1060'], ground: '#3a2848', groundTop: '#4a3858', obstacle: '#6a4a7a', obstacleBot: '#7a5a8a' },
  { name: 'Lava Tunnels', bg: ['#2e1a0a', '#4a2010', '#6a2a0a'], ground: '#4a2a1a', groundTop: '#6a3a2a', obstacle: '#7a4a2a', obstacleBot: '#8a5a3a' },
  { name: 'Ice Cavern',   bg: ['#1a2a3e', '#2a4a6e', '#3a6a9e'], ground: '#4a6a7a', groundTop: '#5a7a8a', obstacle: '#7a9aaa', obstacleBot: '#8aaabc' },
  { name: 'Jungle Depths', bg: ['#0a2a0a', '#103a10', '#1a4a1a'], ground: '#2a3a1a', groundTop: '#3a4a2a', obstacle: '#4a5a2a', obstacleBot: '#5a6a3a' },
  { name: 'Void',         bg: ['#0a0a1a', '#10102a', '#0a0a20'], ground: '#2a2a3a', groundTop: '#3a3a4a', obstacle: '#4a4a5a', obstacleBot: '#5a5a6a' },
]

// ROYGBIV chapter colors
const ROYGBIV = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF',
]

function getChapter(score) {
  return Math.min(Math.floor(score / POINTS_PER_CHAPTER), TOTAL_CHAPTERS - 1)
}
function getChapterInScene(chapter) { return chapter % CHAPTERS_PER_SCENE }
function getScene(chapter) { return Math.floor(chapter / CHAPTERS_PER_SCENE) % SCENES_PER_ACT }
function getAct(chapter) { return Math.floor(chapter / (CHAPTERS_PER_SCENE * SCENES_PER_ACT)) }
function getSceneTheme(chapter) { return SCENE_THEMES[getScene(chapter)] }
function getChapterColor(chapter) { return ROYGBIV[getChapterInScene(chapter)] }

function getDifficulty(chapter) {
  const act = getAct(chapter)
  return {
    gapMin: 200 - act * 8,
    gapMax: 280 - act * 10,
    spacingMin: 280 - act * 10,
    spacingMax: 450 - act * 15,
    scrollSpeed: BASE_SCROLL_SPEED * Math.pow(1.01, chapter),
  }
}

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Rewards persistence
function loadRewards() {
  try {
    const data = JSON.parse(localStorage.getItem('jj_rewards') || '{}')
    return {
      badges: data.badges || [false, false, false, false, false, false, false],
      crowns: data.crowns || 0,
      scepters: data.scepters || 0,
    }
  } catch { return { badges: [false,false,false,false,false,false,false], crowns: 0, scepters: 0 } }
}

function saveRewards(rewards) {
  localStorage.setItem('jj_rewards', JSON.stringify(rewards))
}

function checkRewards(chapter, rewards) {
  const act = getAct(chapter)
  const chapInAct = chapter - act * SCENES_PER_ACT * CHAPTERS_PER_SCENE
  const totalChaptersInAct = SCENES_PER_ACT * CHAPTERS_PER_SCENE
  let changed = false

  // Badge for completing an act (reached last chapter of act)
  if (chapInAct >= totalChaptersInAct - 1 && !rewards.badges[act]) {
    rewards.badges[act] = true
    changed = true
  }

  // Crown for all badges
  if (rewards.badges.every(b => b)) {
    rewards.crowns++
    rewards.badges = [false, false, false, false, false, false, false]
    changed = true
  }

  // Scepter for 3 crowns
  if (rewards.crowns >= 3) {
    rewards.scepters++
    rewards.crowns -= 3
    changed = true
  }

  if (changed) saveRewards(rewards)
  return changed
}

// Scene-specific background decorations
function drawSceneDecor(ctx, scene, scrollX, groundY, canvasW, color, time) {
  const chunkWidth = 400
  const parallax = scrollX * 0.3
  const startChunk = Math.floor((parallax - 100) / chunkWidth)
  const endChunk = Math.floor((parallax + canvasW + 100) / chunkWidth)

  for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const rng = seededRandom(chunk * 7919 + scene * 1013)
    const count = 3 + Math.floor(rng() * 4)

    for (let i = 0; i < count; i++) {
      const x = chunk * chunkWidth + rng() * chunkWidth - parallax
      const onTop = rng() > 0.5
      const baseY = onTop ? 15 + rng() * 50 : groundY - 15 - rng() * 50
      const size = 8 + rng() * 16
      const alpha = 0.15 + rng() * 0.25

      ctx.globalAlpha = alpha

      switch (scene) {
        case 0: // Crystals
          ctx.beginPath()
          ctx.moveTo(x, baseY - size)
          ctx.lineTo(x + size * 0.4, baseY - size * 0.3)
          ctx.lineTo(x + size * 0.3, baseY + size * 0.5)
          ctx.lineTo(x, baseY + size)
          ctx.lineTo(x - size * 0.3, baseY + size * 0.5)
          ctx.lineTo(x - size * 0.4, baseY - size * 0.3)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
          break

        case 1: // Bubbles
          ctx.beginPath()
          ctx.arc(x, baseY + Math.sin(time * 0.002 + i) * 5, size * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x - size * 0.15, baseY - size * 0.15 + Math.sin(time * 0.002 + i) * 5, size * 0.15, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = alpha * 0.4
          ctx.fill()
          break

        case 2: // Mushrooms
          ctx.fillStyle = color
          ctx.fillRect(x - 2, baseY, 4, size * 0.6)
          ctx.beginPath()
          ctx.arc(x, baseY, size * 0.5, Math.PI, 0)
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = alpha * 0.3
          ctx.beginPath()
          ctx.arc(x - size * 0.15, baseY - size * 0.15, size * 0.1, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(x + size * 0.2, baseY - size * 0.05, size * 0.07, 0, Math.PI * 2)
          ctx.fill()
          break

        case 3: // Lava drips
          ctx.fillStyle = color
          ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(time * 0.003 + i * 2))
          ctx.beginPath()
          ctx.arc(x, baseY, size * 0.3, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(x - 1, baseY - size * 0.8, 2, size * 0.8)
          break

        case 4: // Ice shards
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.moveTo(x, baseY - size)
          ctx.lineTo(x + size * 0.25, baseY)
          ctx.lineTo(x - size * 0.25, baseY)
          ctx.closePath()
          ctx.fill()
          ctx.beginPath()
          ctx.moveTo(x + size * 0.3, baseY - size * 0.7)
          ctx.lineTo(x + size * 0.45, baseY)
          ctx.lineTo(x + size * 0.15, baseY)
          ctx.closePath()
          ctx.fill()
          break

        case 5: // Vines
          ctx.strokeStyle = color
          ctx.globalAlpha = alpha
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, onTop ? 0 : groundY)
          const endY = baseY + (onTop ? size : -size)
          ctx.quadraticCurveTo(x + Math.sin(time * 0.001 + i) * 10, (baseY + endY) / 2, x, endY)
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(x, endY, 3, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          break

        case 6: // Void particles (floating, pulsing)
          const pulse = 0.5 + 0.5 * Math.sin(time * 0.004 + i * 1.5)
          ctx.fillStyle = color
          ctx.globalAlpha = alpha * pulse
          ctx.beginPath()
          ctx.arc(x, baseY, size * 0.3 * pulse, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = alpha * pulse * 0.3
          ctx.beginPath()
          ctx.arc(x, baseY, size * 0.6 * pulse, 0, Math.PI * 2)
          ctx.fill()
          break
      }
    }
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = 1
}

function App() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const tapQueueRef = useRef(0)
  const [screen, setScreen] = useState('menu')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('jj_highscore') || '0', 10)
  })
  const [rewards, setRewards] = useState(loadRewards)
  const [lastReward, setLastReward] = useState(null)

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
      chapter: 0,
      lastChapter: -1,
      dying: false,
      deathTime: 0,
    }
    setLastReward(null)
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
    tapQueueRef.current++
  }, [screen, initGame])

  useEffect(() => {
    const canvas = canvasRef.current
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      if (gameRef.current) gameRef.current.groundY = canvas.height - GROUND_HEIGHT
    }
    resize()
    window.addEventListener('resize', resize)

    const handlePointerDown = (e) => { e.preventDefault(); handleTap() }
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

    const loop = () => {
      const game = gameRef.current
      if (!game) return

      const { player, obstacles, particles } = game
      const groundY = canvas.height - GROUND_HEIGHT
      game.groundY = groundY
      const now = performance.now()

      // Update chapter
      game.chapter = getChapter(game.score)
      const difficulty = getDifficulty(game.chapter)
      const chapterColor = getChapterColor(game.chapter)
      const act = getAct(game.chapter)
      const scene = getScene(game.chapter)
      const theme = getSceneTheme(game.chapter)

      // Check for new rewards
      if (game.chapter !== game.lastChapter) {
        const r = loadRewards()
        if (checkRewards(game.chapter, r)) {
          setRewards({...r})
          if (r.scepters > 0) setLastReward('scepter')
          else if (r.crowns > 0 && r.badges.every(b => !b)) setLastReward('crown')
          else if (r.badges[act]) setLastReward('badge')
        }
        game.lastChapter = game.chapter
      }

      // --- Update ---
      const triggerDeath = () => {
        if (!game.dying) {
          game.dying = true
          game.deathTime = now
          if (game.score > highScore) {
            const newHigh = game.score
            setHighScore(newHigh)
            localStorage.setItem('jj_highscore', newHigh.toString())
          }
          for (let i = 0; i < 12; i++) {
            game.particles.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              vx: (Math.random() - 0.5) * 8,
              vy: (Math.random() - 0.5) * 8,
              life: 1,
            })
          }
        }
      }

      if (game.dying) {
        if (now - game.deathTime > 1200) { setScreen('dead'); return }
      } else {
        // Process taps
        while (tapQueueRef.current > 0) {
          tapQueueRef.current--
          if (player.isGrounded && player.landingTime !== null) {
            const elapsed = now - player.landingTime
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
                x: player.x + player.width / 2, y: game.groundY,
                vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4, life: 1,
              })
            }
          } else if (!player.isGrounded && player.airJumpsLeft > 0) {
            player.vy = -DOUBLE_JUMP_POWER
            player.vx = 0
            player.airJumpsLeft--
            for (let i = 0; i < 4; i++) {
              game.particles.push({
                x: player.x + player.width / 2, y: player.y + player.height,
                vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, life: 0.8,
              })
            }
          }
        }

        game.scrollX += difficulty.scrollSpeed

        if (!player.isGrounded) {
          player.vy += GRAVITY
          player.x += player.vx
          player.y += player.vy
          player.vx *= 0.99
          if (player.y >= groundY - player.height) {
            player.y = groundY - player.height
            player.vy = 0; player.vx = 0
            player.isGrounded = true
            player.landingTime = now
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
          if (player.landingTime !== null && now - player.landingTime > LANDING_WINDOW) {
            player.vy = -MIN_JUMP_POWER
            player.vx = 0
            player.isGrounded = false
            player.landingTime = null
          }
        }

        if (player.x + player.width < 0) triggerDeath()

        while (game.nextObstacleX - game.scrollX < canvas.width + 200) {
          const gapSize = difficulty.gapMin + Math.random() * (difficulty.gapMax - difficulty.gapMin)
          const gapY = 100 + Math.random() * (groundY - gapSize - 150)
          obstacles.push({ x: game.nextObstacleX, gapY, gapSize, passed: false })
          game.nextObstacleX += difficulty.spacingMin + Math.random() * (difficulty.spacingMax - difficulty.spacingMin)
        }

        const px = player.x, py = player.y, pw = player.width, ph = player.height
        for (const obs of obstacles) {
          const ox = obs.x - game.scrollX
          if (ox > px + pw || ox + OBSTACLE_WIDTH < px) continue
          if (py < obs.gapY || py + ph > obs.gapY + obs.gapSize) { triggerDeath(); break }
        }

        while (obstacles.length > 0 && obstacles[0].x - game.scrollX < -OBSTACLE_WIDTH - 50) obstacles.shift()
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= 0.03
        if (p.life <= 0) particles.splice(i, 1)
      }

      // --- Draw ---
      const bg = theme.bg
      const caveBg = ctx.createLinearGradient(0, 0, 0, canvas.height)
      caveBg.addColorStop(0, bg[0]); caveBg.addColorStop(0.5, bg[1]); caveBg.addColorStop(1, bg[2])
      ctx.fillStyle = caveBg
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Scene decorations
      drawSceneDecor(ctx, scene, game.scrollX, groundY, canvas.width, chapterColor, now)

      // Ground
      ctx.fillStyle = theme.ground
      ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT)
      ctx.fillStyle = theme.groundTop
      ctx.fillRect(0, groundY, canvas.width, 4)

      // Ceiling
      ctx.fillStyle = theme.ground
      ctx.fillRect(0, 0, canvas.width, 6)

      // Obstacles
      for (const obs of obstacles) {
        const ox = obs.x - game.scrollX
        if (ox > canvas.width + 50 || ox + OBSTACLE_WIDTH < -50) continue
        const cx = ox + OBSTACLE_WIDTH / 2

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
        ctx.fillStyle = theme.obstacle
        ctx.fill()

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
        ctx.fillStyle = theme.obstacleBot
        ctx.fill()
      }

      // Player
      if (!game.dying) {
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
      }

      // Landing window indicator
      if (player.isGrounded && player.landingTime !== null) {
        const remaining = 1 - (now - player.landingTime) / LANDING_WINDOW
        if (remaining > 0) {
          ctx.fillStyle = `rgba(255, 255, 0, ${remaining * 0.8})`
          ctx.fillRect(player.x - 2, groundY + 5, (player.width + 4) * remaining, 6)
        }
      }

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = p.life
        ctx.fillStyle = chapterColor
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      }
      ctx.globalAlpha = 1

      // HUD
      const actNum = act + 1
      const sceneNum = scene + 1
      const chapNum = getChapterInScene(game.chapter) + 1

      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 4
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.strokeText(game.score.toString(), canvas.width / 2, 60)
      ctx.fillText(game.score.toString(), canvas.width / 2, 60)

      ctx.font = 'bold 18px sans-serif'
      ctx.fillStyle = chapterColor
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 3
      const label = `ACT ${actNum} | ${theme.name} | CH ${chapNum}`
      ctx.strokeText(label, canvas.width / 2, 88)
      ctx.fillText(label, canvas.width / 2, 88)

      // Death fade
      if (game.dying) {
        const fade = Math.min((now - game.deathTime) / 1200, 1)
        ctx.fillStyle = `rgba(0, 0, 0, ${fade * 0.7})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [screen, highScore])

  const r = rewards
  const badgeCount = r.badges.filter(b => b).length

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'block', touchAction: 'none' }} />

      {screen === 'menu' && (
        <div style={overlayStyle} onPointerDown={handleTap}>
          <div style={{ fontSize: 42, fontWeight: 'bold', color: '#FFD600', textShadow: '3px 3px 0 #E65100' }}>
            JUMPING
          </div>
          <div style={{ fontSize: 52, fontWeight: 'bold', color: '#FFD600', textShadow: '3px 3px 0 #E65100', marginBottom: 20 }}>
            JEHOSAPHAT
          </div>

          {(r.scepters > 0 || r.crowns > 0 || badgeCount > 0) && (
            <div style={{ fontSize: 24, marginBottom: 15 }}>
              {r.scepters > 0 && <span title="Imperial Scepter">{'<*> '.repeat(r.scepters)}</span>}
              {r.crowns > 0 && <span style={{ color: '#FFD700' }} title="Crown">{'W '.repeat(r.crowns)}</span>}
              {badgeCount > 0 && (
                <span style={{ color: '#C0C0C0' }}>
                  {r.badges.map((b, i) => b ? ROYGBIV[i] : null).filter(Boolean).map((c, i) => (
                    <span key={i} style={{ color: c }}>*</span>
                  ))}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 16, color: '#fff', marginBottom: 8 }}>
            Tap when you land to jump!
          </div>
          <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>
            Early tap = big jump | Triple jump in air!
          </div>
          <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>
            7 Acts x 7 Scenes x 7 Chapters = 343 chapters
          </div>
          <div style={buttonStyle}>TAP TO START</div>
          {highScore > 0 && (
            <div style={{ fontSize: 16, color: '#FFD600', marginTop: 15 }}>
              BEST: {highScore}
            </div>
          )}
        </div>
      )}

      {screen === 'dead' && (
        <div style={overlayStyle} onPointerDown={handleTap}>
          <div style={{ fontSize: 36, fontWeight: 'bold', color: '#FF5722', marginBottom: 15 }}>
            GAME OVER
          </div>
          <div style={{ fontSize: 64, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>
            {score}
          </div>
          <div style={{ fontSize: 18, color: '#FFD600', marginBottom: 8 }}>
            BEST: {highScore}
          </div>

          {lastReward === 'badge' && (
            <div style={{ fontSize: 20, color: '#FFD700', marginBottom: 10 }}>
              BADGE EARNED!
            </div>
          )}
          {lastReward === 'crown' && (
            <div style={{ fontSize: 22, color: '#FFD700', marginBottom: 10 }}>
              CROWN EARNED! All acts complete!
            </div>
          )}
          {lastReward === 'scepter' && (
            <div style={{ fontSize: 24, color: '#FF00FF', marginBottom: 10 }}>
              IMPERIAL SCEPTER! 3 crowns traded!
            </div>
          )}

          {(r.scepters > 0 || r.crowns > 0 || badgeCount > 0) && (
            <div style={{ fontSize: 22, marginBottom: 12 }}>
              {r.scepters > 0 && <span title="Imperial Scepter">{'<*> '.repeat(r.scepters)}</span>}
              {r.crowns > 0 && <span style={{ color: '#FFD700' }} title="Crown">{'W '.repeat(r.crowns)}</span>}
              {badgeCount > 0 && (
                <span>
                  {r.badges.map((b, i) => b ? ROYGBIV[i] : null).filter(Boolean).map((c, i) => (
                    <span key={i} style={{ color: c }}>*</span>
                  ))}
                </span>
              )}
            </div>
          )}

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
