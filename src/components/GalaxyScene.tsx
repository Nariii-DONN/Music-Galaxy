import {
  useEffect,
  useMemo,
  useRef,
} from 'react'

import {
  Canvas,
  useFrame,
  useThree,
} from '@react-three/fiber'

import * as THREE from 'three'

import type { Track } from '../lib/types'

import {
  audioEngine,
} from '../lib/audioEngine'

type Bands = {
  sub: number
  bass: number
  lowMid: number
  mid: number
  upperMid: number
  presence: number
  treble: number
  air: number
  overall: number
}

type PlanetProfile = {
  primary: keyof Bands
  secondary: keyof Bands
  radial: number
  vertical: number
  lateral: number
  orbitSpeed: number
  wobbleSpeed: number
  rotationSpeed: number
  response: number
  phase: number
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function damp(
  current: number,
  target: number,
  speed: number,
  delta: number,
) {
  return THREE.MathUtils.damp(
    current,
    target,
    speed,
    delta,
  )
}

function clamp01(value: number) {
  return THREE.MathUtils.clamp(
    value,
    0,
    1,
  )
}

/* -------------------------------------------------------------------------- */
/* CAMERA                                                                     */
/* -------------------------------------------------------------------------- */

function GalaxyCamera() {
  const {
    camera,
    gl,
  } = useThree()

  const dragging =
    useRef(false)

  const pointer =
    useRef({
      x: 0,
      y: 0,
    })

  const targetYaw =
    useRef(0)

  const targetPitch =
    useRef(0)

  const yaw =
    useRef(0)

  const pitch =
    useRef(0)

  const targetDistance =
    useRef(12)

  const distance =
    useRef(12)

  useEffect(() => {
    const element =
      gl.domElement

    const onPointerDown = (
      event: PointerEvent,
    ) => {
      dragging.current = true

      pointer.current = {
        x: event.clientX,
        y: event.clientY,
      }

      try {
        element.setPointerCapture(
          event.pointerId,
        )
      } catch {
        // Ignore.
      }
    }

    const onPointerMove = (
      event: PointerEvent,
    ) => {
      if (
        !dragging.current
      ) {
        return
      }

      const dx =
        event.clientX -
        pointer.current.x

      const dy =
        event.clientY -
        pointer.current.y

      pointer.current = {
        x: event.clientX,
        y: event.clientY,
      }

      targetYaw.current +=
        dx * 0.0025

      targetPitch.current =
        THREE.MathUtils.clamp(
          targetPitch.current +
            dy * 0.0015,
          -0.7,
          0.7,
        )
    }

    const onPointerUp = (
      event: PointerEvent,
    ) => {
      dragging.current = false

      try {
        element.releasePointerCapture(
          event.pointerId,
        )
      } catch {
        // Ignore.
      }
    }

    const onWheel = (
      event: WheelEvent,
    ) => {
      event.preventDefault()

      targetDistance.current =
        THREE.MathUtils.clamp(
          targetDistance.current +
            event.deltaY * 0.006,
          7,
          18,
        )
    }

    element.addEventListener(
      'pointerdown',
      onPointerDown,
    )

    element.addEventListener(
      'pointermove',
      onPointerMove,
    )

    element.addEventListener(
      'pointerup',
      onPointerUp,
    )

    element.addEventListener(
      'pointercancel',
      onPointerUp,
    )

    element.addEventListener(
      'wheel',
      onWheel,
      {
        passive: false,
      },
    )

    return () => {
      element.removeEventListener(
        'pointerdown',
        onPointerDown,
      )

      element.removeEventListener(
        'pointermove',
        onPointerMove,
      )

      element.removeEventListener(
        'pointerup',
        onPointerUp,
      )

      element.removeEventListener(
        'pointercancel',
        onPointerUp,
      )

      element.removeEventListener(
        'wheel',
        onWheel,
      )
    }
  }, [gl])

  useFrame(
    (state, delta) => {
      const time =
        state.clock.getElapsedTime()

      const bands =
        audioEngine.getFrequencyBands()

      /*
       * The whole camera responds mostly
       * to lower frequencies.
       */
      const musicRotation =
        bands.lowMid * 0.00025 +
        bands.mid * 0.00012 +
        bands.upperMid * 0.00008

      if (
        !dragging.current
      ) {
        targetYaw.current +=
          (
            0.00008 +
            musicRotation +
            bands.sub * 0.00008
          ) *
          delta *
          60
      }

      yaw.current =
        damp(
          yaw.current,
          targetYaw.current,
          3.0,
          delta,
        )

      pitch.current =
        damp(
          pitch.current,
          targetPitch.current,
          3.0,
          delta,
        )

      /*
       * Deep bass gently moves the
       * camera inward.
       */
      const targetCameraDistance =
        targetDistance.current -
        bands.sub * 0.55 -
        bands.bass * 0.18

      distance.current =
        damp(
          distance.current,
          targetCameraDistance,
          2.5,
          delta,
        )

      const radius =
        distance.current

      const x =
        Math.sin(
          yaw.current,
        ) *
        radius

      const z =
        Math.cos(
          yaw.current,
        ) *
        radius

      const y =
        1.5 +
        Math.sin(
          pitch.current,
        ) *
          2.4 +
        bands.lowMid *
          0.08

      camera.position.x =
        damp(
          camera.position.x,
          x,
          2.7,
          delta,
        )

      camera.position.y =
        damp(
          camera.position.y,
          y,
          2.7,
          delta,
        )

      camera.position.z =
        damp(
          camera.position.z,
          z,
          2.7,
          delta,
        )

      /*
       * Tiny high-frequency camera shimmer.
       * Kept extremely small for cinematic
       * smoothness.
       */
      camera.position.y +=
        Math.sin(
          time *
            (
              0.8 +
              bands.air * 1.5
            ),
        ) *
        bands.air *
        0.012

      camera.lookAt(
        0,
        0,
        0,
      )
    },
  )

  return null
}

/* -------------------------------------------------------------------------- */
/* STAR FIELD                                                                  */
/* -------------------------------------------------------------------------- */

function StarField() {
  const positions =
    useMemo(() => {
      const count = 1800

      const values =
        new Float32Array(
          count * 3,
        )

      for (
        let i = 0;
        i < count;
        i += 1
      ) {
        const radius =
          22 +
          Math.random() * 55

        const theta =
          Math.random() *
          Math.PI *
          2

        const phi =
          Math.acos(
            2 *
              Math.random() -
              1,
          )

        const sinPhi =
          Math.sin(phi)

        const index =
          i * 3

        values[index] =
          radius *
          sinPhi *
          Math.cos(theta)

        values[index + 1] =
          radius *
          Math.cos(phi)

        values[index + 2] =
          radius *
          sinPhi *
          Math.sin(theta)
      }

      return values
    }, [])

  const geometry =
    useMemo(() => {
      const result =
        new THREE.BufferGeometry()

      result.setAttribute(
        'position',
        new THREE.BufferAttribute(
          positions,
          3,
        ),
      )

      return result
    }, [positions])

  const material =
    useMemo(
      () =>
        new THREE.PointsMaterial(
          {
            color: '#d9d8ff',
            size: 0.11,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.62,
            depthWrite: false,
            blending:
              THREE.AdditiveBlending,
          },
        ),
      [],
    )

  const points =
    useRef<THREE.Points>(
      null,
    )

  const currentRotationSpeed =
    useRef(0.003)

  const currentScale =
    useRef(1)

  const currentOpacity =
    useRef(0.62)

  useFrame(
    (state, delta) => {
      if (!points.current) {
        return
      }

      const bands =
        audioEngine.getFrequencyBands()

      /*
       * TREBLE controls star motion.
       */
      const targetSpeed =
        0.0025 +
        bands.treble * 0.016 +
        bands.air * 0.008

      currentRotationSpeed.current =
        damp(
          currentRotationSpeed.current,
          targetSpeed,
          3.5,
          delta,
        )

      points.current.rotation.y +=
        currentRotationSpeed.current *
        delta *
        60

      /*
       * AIR creates delicate expansion.
       */
      currentScale.current =
        damp(
          currentScale.current,
          1 +
            bands.air * 0.065 +
            bands.treble * 0.025,
          3.5,
          delta,
        )

      points.current.scale.setScalar(
        currentScale.current,
      )

      currentOpacity.current =
        damp(
          currentOpacity.current,
          0.45 +
            bands.treble * 0.22 +
            bands.air * 0.18,
          4,
          delta,
        )

      material.opacity =
        currentOpacity.current

      points.current.rotation.x =
        damp(
          points.current.rotation.x,
          Math.sin(
            state.clock.getElapsedTime() *
              0.15,
          ) *
            bands.air *
            0.035,
          2,
          delta,
        )
    },
  )

  return (
    <points
      ref={points}
      geometry={geometry}
    >
      <primitive
        object={material}
        attach="material"
      />
    </points>
  )
}

/* -------------------------------------------------------------------------- */
/* PARTICLE FIELD                                                              */
/* -------------------------------------------------------------------------- */

function ParticleField() {
  const positions =
    useMemo(() => {
      const count = 550

      const values =
        new Float32Array(
          count * 3,
        )

      for (
        let i = 0;
        i < count;
        i += 1
      ) {
        const index =
          i * 3

        values[index] =
          (
            Math.random() -
            0.5
          ) * 15

        values[index + 1] =
          (
            Math.random() -
            0.5
          ) * 9

        values[index + 2] =
          (
            Math.random() -
            0.5
          ) * 15
      }

      return values
    }, [])

  const geometry =
    useMemo(() => {
      const result =
        new THREE.BufferGeometry()

      result.setAttribute(
        'position',
        new THREE.BufferAttribute(
          positions,
          3,
        ),
      )

      return result
    }, [positions])

  const material =
    useMemo(
      () =>
        new THREE.PointsMaterial(
          {
            color: '#ffffff',
            size: 0.055,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
            blending:
              THREE.AdditiveBlending,
          },
        ),
      [],
    )

  const points =
    useRef<THREE.Points>(
      null,
    )

  const currentScale =
    useRef(1)

  useFrame(
    (state, delta) => {
      if (!points.current) {
        return
      }

      const bands =
        audioEngine.getFrequencyBands()

      const time =
        state.clock.getElapsedTime()

      /*
       * UPPER MID controls the swirl.
       */
      points.current.rotation.y +=
        delta *
        (
          0.006 +
          bands.upperMid *
            0.035
        )

      /*
       * PRESENCE creates a slow wobble.
       */
      points.current.rotation.z =
        damp(
          points.current.rotation.z,
          Math.sin(
            time *
              (
                0.18 +
                bands.presence *
                  1.2
              ),
          ) *
            bands.presence *
            0.06,
          2.8,
          delta,
        )

      const targetScale =
        1 +
        bands.upperMid *
          0.045 +
        bands.presence *
          0.04

      currentScale.current =
        damp(
          currentScale.current,
          targetScale,
          3.5,
          delta,
        )

      points.current.scale.setScalar(
        currentScale.current,
      )

      material.opacity =
        damp(
          material.opacity,
          0.2 +
            bands.presence *
              0.28 +
            bands.air *
              0.12,
          4,
          delta,
        )
    },
  )

  return (
    <points
      ref={points}
      geometry={geometry}
    >
      <primitive
        object={material}
        attach="material"
      />
    </points>
  )
}

/* -------------------------------------------------------------------------- */
/* PLANET PROFILES                                                             */
/* -------------------------------------------------------------------------- */

function createPlanetProfile(
  index: number,
): PlanetProfile {
  const profiles: PlanetProfile[] =
    [
      {
        primary: 'sub',
        secondary: 'bass',
        radial: 0.62,
        vertical: 0.16,
        lateral: 0.18,
        orbitSpeed: 0.045,
        wobbleSpeed: 0.22,
        rotationSpeed: 0.06,
        response: 1.15,
        phase: 0.15,
      },
      {
        primary: 'bass',
        secondary: 'sub',
        radial: 0.5,
        vertical: 0.2,
        lateral: 0.34,
        orbitSpeed: 0.07,
        wobbleSpeed: 0.32,
        rotationSpeed: 0.1,
        response: 1.08,
        phase: 0.9,
      },
      {
        primary: 'lowMid',
        secondary: 'mid',
        radial: 0.25,
        vertical: 0.48,
        lateral: 0.3,
        orbitSpeed: 0.09,
        wobbleSpeed: 0.42,
        rotationSpeed: 0.12,
        response: 1,
        phase: 1.75,
      },
      {
        primary: 'mid',
        secondary: 'upperMid',
        radial: 0.18,
        vertical: 0.42,
        lateral: 0.28,
        orbitSpeed: 0.11,
        wobbleSpeed: 0.54,
        rotationSpeed: 0.18,
        response: 0.96,
        phase: 2.45,
      },
      {
        primary: 'upperMid',
        secondary: 'lowMid',
        radial: 0.34,
        vertical: 0.3,
        lateral: 0.48,
        orbitSpeed: 0.14,
        wobbleSpeed: 0.7,
        rotationSpeed: 0.24,
        response: 0.95,
        phase: 3.15,
      },
      {
        primary: 'presence',
        secondary: 'upperMid',
        radial: 0.28,
        vertical: 0.34,
        lateral: 0.44,
        orbitSpeed: 0.17,
        wobbleSpeed: 0.84,
        rotationSpeed: 0.32,
        response: 0.9,
        phase: 4.0,
      },
      {
        primary: 'treble',
        secondary: 'presence',
        radial: 0.2,
        vertical: 0.22,
        lateral: 0.34,
        orbitSpeed: 0.21,
        wobbleSpeed: 1.05,
        rotationSpeed: 0.42,
        response: 0.82,
        phase: 4.75,
      },
      {
        primary: 'air',
        secondary: 'treble',
        radial: 0.14,
        vertical: 0.18,
        lateral: 0.24,
        orbitSpeed: 0.26,
        wobbleSpeed: 1.25,
        rotationSpeed: 0.55,
        response: 0.72,
        phase: 5.5,
      },
    ]

  return profiles[
    index % profiles.length
  ]
}

/* -------------------------------------------------------------------------- */
/* PLANET                                                                     */
/* -------------------------------------------------------------------------- */

function Planet({
  track,
  position,
  index,
  active,
  onSelect,
}: {
  track: Track
  position: [
    number,
    number,
    number,
  ]
  index: number
  active: boolean
  onSelect: (
    track: Track,
  ) => void
}) {
  const mesh =
    useRef<THREE.Mesh>(
      null,
    )

  const material =
    useRef<THREE.MeshStandardMaterial>(
      null,
    )

  const profile =
    useMemo(
      () =>
        createPlanetProfile(
          index,
        ),
      [index],
    )

  const base =
    useMemo(
      () =>
        new THREE.Vector3(
          position[0],
          position[1],
          position[2],
        ),
      [position],
    )

  const current =
    useMemo(
      () =>
        new THREE.Vector3(
          position[0],
          position[1],
          position[2],
        ),
      [position],
    )

  const target =
    useMemo(
      () =>
        new THREE.Vector3(
          position[0],
          position[1],
          position[2],
        ),
      [position],
    )

  const scale =
    useRef(1)

  useFrame(
    (state, delta) => {
      if (!mesh.current) {
        return
      }

      const time =
        state.clock.getElapsedTime()

      const bands =
        audioEngine.getFrequencyBands()

      const primary =
        clamp01(
          bands[
            profile.primary
          ] *
            profile.response,
        )

      const secondary =
        clamp01(
          bands[
            profile.secondary
          ],
        )

      /*
       * Every planet uses a different
       * movement equation.
       */
      const angle =
        time *
          (
            profile.orbitSpeed +
            primary *
              0.16
          ) +
        profile.phase

      /*
       * Primary frequency controls
       * orbital/radial displacement.
       */
      const radialOffset =
        primary *
        profile.radial

      /*
       * Secondary frequency controls
       * vertical movement.
       */
      const verticalOffset =
        secondary *
        profile.vertical

      /*
       * Lateral movement gets a unique
       * phase so planets do not move
       * together.
       */
      const lateralOffset =
        Math.sin(
          time *
            profile.wobbleSpeed +
            profile.phase,
        ) *
        primary *
        profile.lateral

      target.x =
        base.x +
        Math.cos(angle) *
          radialOffset +
        lateralOffset

      target.y =
        base.y +
        Math.sin(
          angle *
            (
              0.55 +
              secondary *
                0.65
            ) +
            profile.phase,
        ) *
          (
            0.08 +
            verticalOffset
          )

      target.z =
        base.z +
        Math.sin(angle) *
          radialOffset

      /*
       * Stronger bass causes more
       * physical movement for the
       * active planet.
       */
      if (active) {
        target.x +=
          Math.sin(
            time *
              0.7 +
              profile.phase,
          ) *
          bands.sub *
          0.08

        target.z +=
          Math.cos(
            time *
              0.65 +
              profile.phase,
          ) *
          bands.bass *
          0.08
      }

      /*
       * Smooth position interpolation.
       */
      current.lerp(
        target,
        1 -
          Math.exp(
            -(
              2.8 +
              primary *
                2
            ) *
              delta,
          ),
      )

      mesh.current.position.copy(
        current,
      )

      /*
       * Mid frequencies influence
       * rotation.
       */
      const targetRotationX =
        time *
        (
          profile.rotationSpeed +
          bands.mid *
            0.16
        ) +
        profile.phase

      const targetRotationY =
        time *
        (
          profile.rotationSpeed *
            1.35 +
          bands.upperMid *
            0.24
        ) +
        profile.phase *
          1.7

      const targetRotationZ =
        Math.sin(
          time *
            (
              0.18 +
              bands.presence *
                0.9
            ) +
            profile.phase,
        ) *
        (
          0.025 +
          bands.presence *
            0.18
        )

      mesh.current.rotation.x =
        damp(
          mesh.current.rotation.x,
          targetRotationX,
          2.8,
          delta,
        )

      mesh.current.rotation.y =
        damp(
          mesh.current.rotation.y,
          targetRotationY,
          2.8,
          delta,
        )

      mesh.current.rotation.z =
        damp(
          mesh.current.rotation.z,
          targetRotationZ,
          3.5,
          delta,
        )

      /*
       * Sub/bass makes larger planets
       * breathe.
       */
      const targetScale =
        active
          ? 1 +
            bands.sub *
              0.16 +
            bands.bass *
              0.1
          : 1 +
            primary *
              0.08

      scale.current =
        damp(
          scale.current,
          targetScale,
          4.5,
          delta,
        )

      mesh.current.scale.setScalar(
        scale.current,
      )

      /*
       * Different planets have
       * different glow response.
       */
      if (
        material.current
      ) {
        const targetEmission =
          active
            ? 2.5 +
              primary *
                5 +
              secondary *
                2
            : 1.05 +
              primary *
                2.6

        material.current.emissiveIntensity =
          damp(
            material.current
              .emissiveIntensity,
            targetEmission,
            5,
            delta,
          )
      }
    },
  )

  const radius =
    active
      ? 0.47
      : 0.29 +
        (index % 3) *
          0.06

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={() =>
        onSelect(track)
      }
    >
      <sphereGeometry
        args={[
          radius,
          24,
          24,
        ]}
      />

      <meshStandardMaterial
        ref={material}
        color={
          track.color
        }
        emissive={
          track.color
        }
        emissiveIntensity={
          active
            ? 2.5
            : 1.05
        }
        metalness={0.28}
        roughness={0.32}
      />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* GALAXY WORLD                                                                */
/* -------------------------------------------------------------------------- */

function GalaxyWorld({
  tracks,
  active,
  onSelect,
}: {
  tracks: Track[]
  active: Track
  pulse: number
  onSelect: (
    track: Track,
  ) => void
}) {
  const group =
    useRef<THREE.Group>(
      null,
    )

  const core =
    useRef<THREE.Mesh>(
      null,
    )

  const coreMaterial =
    useRef<THREE.MeshStandardMaterial>(
      null,
    )

  const glow =
    useRef<THREE.Mesh>(
      null,
    )

  const glowMaterial =
    useRef<THREE.MeshBasicMaterial>(
      null,
    )

  const positions =
    useMemo(
      () =>
        tracks.map(
          (_, index) => {
            const angle =
              (
                index /
                Math.max(
                  tracks.length,
                  1,
                )
              ) *
              Math.PI *
              2

            const layer =
              index % 4

            const radius =
              2.05 +
              layer * 0.58

            return [
              Math.cos(
                angle,
              ) *
                radius,

              Math.sin(
                angle * 2,
              ) *
                (
                  0.44 +
                  layer * 0.08
                ),

              Math.sin(
                angle,
              ) *
                radius,
            ] as [
              number,
              number,
              number,
            ]
          },
        ),
      [tracks],
    )

  const groupScale =
    useRef(1)

  const coreScale =
    useRef(1)

  const glowScale =
    useRef(1)

  useFrame(
    (state, delta) => {
      const time =
        state.clock.getElapsedTime()

      const bands =
        audioEngine.getFrequencyBands()

      /*
       * Overall galaxy movement is slow.
       */
      if (
        group.current
      ) {
        const rotationSpeed =
          0.004 +
          bands.lowMid *
            0.018 +
          bands.upperMid *
            0.012

        group.current.rotation.y +=
          rotationSpeed *
          delta

        /*
         * Presence gently tilts the
         * entire system.
         */
        const targetTilt =
          Math.sin(
            time *
              (
                0.12 +
                bands.mid *
                  0.28
              ),
          ) *
          (
            0.006 +
            bands.presence *
              0.025
          )

        group.current.rotation.x =
          damp(
            group.current
              .rotation
              .x,
            targetTilt,
            2,
            delta,
          )

        /*
         * Sub-bass creates extremely
         * subtle whole-system breathing.
         */
        const targetGroupScale =
          1 +
          bands.sub *
            0.028 +
          bands.bass *
            0.012

        groupScale.current =
          damp(
            groupScale.current,
            targetGroupScale,
            3,
            delta,
          )

        group.current.scale.setScalar(
          groupScale.current,
        )
      }

      /*
       * DEEP / SUB → core size.
       */
      if (
        core.current
      ) {
        const target =
          1 +
          bands.sub *
            0.25 +
          bands.bass *
            0.08

        coreScale.current =
          damp(
            coreScale.current,
            target,
            6,
            delta,
          )

        core.current.scale.setScalar(
          coreScale.current,
        )
      }

      /*
       * BASS → core energy.
       */
      if (
        coreMaterial.current
      ) {
        const target =
          3.5 +
          bands.sub *
            7 +
          bands.bass *
            4

        coreMaterial.current.emissiveIntensity =
          damp(
            coreMaterial.current
              .emissiveIntensity,
            target,
            5,
            delta,
          )
      }

      /*
       * Low-frequency glow.
       */
      if (
        glow.current
      ) {
        const target =
          1 +
          bands.sub *
            0.14 +
          bands.bass *
            0.08

        glowScale.current =
          damp(
            glowScale.current,
            target,
            4,
            delta,
          )

        glow.current.scale.setScalar(
          glowScale.current,
        )
      }

      if (
        glowMaterial.current
      ) {
        const targetOpacity =
          0.025 +
          bands.sub *
            0.065 +
          bands.bass *
            0.04

        glowMaterial.current.opacity =
          damp(
            glowMaterial.current
              .opacity,
            targetOpacity,
            4,
            delta,
          )
      }
    },
  )

  const bands =
    audioEngine.getFrequencyBands()

  return (
    <>
      <ambientLight
        intensity={
          0.28 +
          bands.overall *
            0.15
        }
      />

      <pointLight
        position={[
          0,
          0,
          0,
        ]}
        intensity={
          10 +
          bands.sub *
            24 +
          bands.bass *
            12
        }
        distance={20}
        color={
          active.color
        }
      />

      <StarField />

      <ParticleField />

      <group ref={group}>

        {/* CORE */}

        <mesh ref={core}>

          <sphereGeometry
            args={[
              0.65,
              40,
              40,
            ]}
          />

          <meshStandardMaterial
            ref={
              coreMaterial
            }
            color="#080812"
            emissive={
              active.color
            }
            emissiveIntensity={
              3.5
            }
            roughness={0.2}
          />

        </mesh>


        {/* CORE GLOW */}

        <mesh ref={glow}>

          <sphereGeometry
            args={[
              0.92,
              32,
              32,
            ]}
          />

          <meshBasicMaterial
            ref={
              glowMaterial
            }
            color={
              active.color
            }
            transparent
            opacity={0.03}
            depthWrite={
              false
            }
          />

        </mesh>


        {/* PLANETS */}

        {tracks.map(
          (
            track,
            index,
          ) => (
            <Planet
              key={
                track.id
              }
              track={
                track
              }
              position={
                positions[index]
              }
              index={
                index
              }
              active={
                track.id ===
                active.id
              }
              onSelect={
                onSelect
              }
            />
          ),
        )}


        {/* SUB ORBIT */}

        <MusicOrbit
          band="sub"
          radius={2.05}
          thickness={0.018}
          color={
            active.color
          }
          speed={0.025}
        />


        {/* BASS ORBIT */}

        <MusicOrbit
          band="bass"
          radius={2.8}
          thickness={0.016}
          color={
            active.color
          }
          speed={-0.032}
        />


        {/* MID ORBIT */}

        <MusicOrbit
          band="mid"
          radius={3.45}
          thickness={0.013}
          color="#ffffff"
          speed={0.022}
        />


        {/* TREBLE ORBIT */}

        <MusicOrbit
          band="treble"
          radius={4.1}
          thickness={0.011}
          color={
            active.color
          }
          speed={-0.045}
        />


        {/* AIR ORBIT */}

        <MusicOrbit
          band="air"
          radius={4.55}
          thickness={0.008}
          color="#ffffff"
          speed={0.058}
        />

      </group>

      <GalaxyCamera />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* MUSIC ORBIT                                                                 */
/* -------------------------------------------------------------------------- */

function MusicOrbit({
  band,
  radius,
  thickness,
  color,
  speed,
}: {
  band: keyof Bands
  radius: number
  thickness: number
  color: string
  speed: number
}) {
  const ring =
    useRef<THREE.Mesh>(
      null,
    )

  const material =
    useRef<THREE.MeshBasicMaterial>(
      null,
    )

  const rotation =
    useRef(0)

  const scale =
    useRef(1)

  useFrame(
    (state, delta) => {
      if (!ring.current) {
        return
      }

      const time =
        state.clock.getElapsedTime()

      const bands =
        audioEngine.getFrequencyBands()

      const energy =
        clamp01(
          bands[band],
        )

      /*
       * Frequency controls speed.
       */
      rotation.current +=
        speed *
        (
          0.35 +
          energy *
            2.2
        ) *
        delta

      ring.current.rotation.z =
        damp(
          ring.current
            .rotation
            .z,
          rotation.current,
          2.5,
          delta,
        )

      /*
       * Frequency controls expansion.
       */
      scale.current =
        damp(
          scale.current,
          1 +
            energy *
              0.08,
          3.5,
          delta,
        )

      ring.current.scale.setScalar(
        scale.current,
      )

      /*
       * Slight non-planar motion.
       */
      ring.current.rotation.x =
        damp(
          ring.current
            .rotation
            .x,
          Math.PI / 2 +
            Math.sin(
              time * 0.16,
            ) *
              energy *
              0.035,
          2.2,
          delta,
        )

      if (
        material.current
      ) {
        material.current.opacity =
          damp(
            material.current
              .opacity,
            0.025 +
              energy *
                0.19,
            4,
            delta,
          )
      }
    },
  )

  return (
    <mesh ref={ring}>

      <ringGeometry
        args={[
          radius,
          radius +
            thickness,
          128,
        ]}
      />

      <meshBasicMaterial
        ref={material}
        color={color}
        transparent
        opacity={0.06}
        depthWrite={
          false
        }
      />

    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* SCENE                                                                      */
/* -------------------------------------------------------------------------- */

export default function GalaxyScene({
  tracks,
  active,
  pulse,
  onSelect,
}: {
  tracks: Track[]
  active: Track
  pulse: number
  onSelect: (
    track: Track,
  ) => void
}) {
  return (
    <Canvas
      camera={{
        position: [
          0,
          1.5,
          12,
        ],
        fov: 52,
      }}
      dpr={[
        1,
        1.5,
      ]}
      gl={{
        antialias: true,
        powerPreference:
          'high-performance',
      }}
    >
      <color
        attach="background"
        args={[
          '#03040d',
        ]}
      />

      <fog
        attach="fog"
        args={[
          '#03040d',
          8,
          24,
        ]}
      />

      <GalaxyWorld
        tracks={
          tracks
        }
        active={
          active
        }
        pulse={
          pulse
        }
        onSelect={
          onSelect
        }
      />
    </Canvas>
  )
}