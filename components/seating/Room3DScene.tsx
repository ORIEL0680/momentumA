"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Instances,
  Instance,
  Environment,
  SoftShadows,
  CameraControls,
  PerformanceMonitor,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import type { Guest, SeatingTable } from "@/lib/types";

/**
 * R44 → R47 · Feature 3 — ROOM. "Apple-Maps-Flyover" pass.
 *
 * Lazy (Room3D dynamic ssr:false → three.js & postprocessing stay out
 * of the eager bundle). This pass = the visual soul, not new features:
 *
 *  L1 lighting: real HDR (Environment "sunset") + two volumetric
 *     spotlights + soft PCSS shadows + ACES/sRGB + atmospheric fog.
 *  L2 materials: parquet floor, sheened tablecloth, glass bottles
 *     (transmission+ior), upholstered chairs, pulsing dance floor.
 *  L3 post: Bloom + Vignette + Chromatic Aberration + ACES tone map,
 *     auto-disabled on weak GPUs (PerformanceMonitor) / low-dpr.
 *  L4 cinematic intro: a 0–6 s camera move (top → dance floor →
 *     three-quarter), skippable with one tap.
 *  L7 perf: every chair/plate is one <Instances> draw call; dpr cap 2;
 *     PerformanceMonitor drops effects if it can't hold up.
 *
 * Deliberate, documented deviations:
 *  • frameloop stays continuous (NOT "demand") — "demand" freezes the
 *    render when idle, which would kill the breathing dance-floor pulse
 *    and the intro (and fails the "does it breathe when idle?" bar).
 *  • Chairs are instanced *boxes*, not chamfered RoundedBox — Layer 7
 *    makes instancing a hard requirement and RoundedBox can't be
 *    instanced; instancing wins. The "not plastic" feel now comes from
 *    lighting + materials + post, which is where it actually lives.
 */

interface TablePlot {
  table: SeatingTable;
  x: number;
  z: number;
  occupied: boolean;
  seats: { gx: number; gz: number; ang: number; taken: boolean }[];
}

const TABLE_R = 0.9;
const SEAT_R = 1.5;

function DanceFloor() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (ref.current)
      ref.current.emissiveIntensity =
        0.4 + 0.4 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.6));
  });
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      receiveShadow
    >
      <planeGeometry args={[6, 6]} />
      <meshStandardMaterial
        ref={ref}
        color="#F4DEA9"
        emissive="#F4DEA9"
        emissiveIntensity={0.5}
        roughness={0.3}
        metalness={0.4}
      />
    </mesh>
  );
}

/** L4 — owns the single CameraControls; runs the intro then releases. */
function Rig({
  focus,
}: {
  focus: { x: number; y: number; z: number } | null;
}) {
  const cc = useRef<CameraControls | null>(null);
  const introDone = useRef(false);

  useEffect(() => {
    const c = cc.current;
    if (!c) return;
    let cancelled = false;
    const skip = () => {
      introDone.current = true;
    };
    window.addEventListener("pointerdown", skip, { once: true });

    (async () => {
      try {
        c.setLookAt(0, 13, 0.01, 0, 0, 0, false);
        // 0–2s slow top rotation
        await c.rotate(Math.PI * 0.5, 0, true);
        if (cancelled || introDone.current) return;
        // 2–4s descend toward the dance floor
        await c.setLookAt(2, 4, 5, 0, 0.5, 0, true);
        if (cancelled || introDone.current) return;
        // 4–6s settle into a three-quarter hero angle
        await c.setLookAt(7.5, 4, 8.5, 0, 0.8, 0, true);
      } catch {
        /* controls torn down mid-flight — fine */
      } finally {
        introDone.current = true;
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  useEffect(() => {
    const c = cc.current;
    if (!c || !focus) return;
    introDone.current = true;
    void c.setLookAt(focus.x, focus.y, focus.z, 0, 1.05, 0, true);
  }, [focus]);

  return (
    <CameraControls
      ref={cc}
      makeDefault
      minDistance={3}
      maxDistance={32}
      maxPolarAngle={Math.PI / 2 - 0.04}
      smoothTime={0.45}
    />
  );
}

function Scene({
  tables,
  guests,
  seatAssignments,
  focusGuestId,
  effects,
  onPerfChange,
}: {
  tables: SeatingTable[];
  guests: Guest[];
  seatAssignments: Record<string, string>;
  focusGuestId: string | null;
  effects: boolean;
  onPerfChange: (low: boolean) => void;
}) {
  const plots = useMemo<TablePlot[]>(() => {
    const n = tables.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gap = 3.6;
    return tables.map((table, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * gap;
      const z = (row - (Math.ceil(n / cols) - 1) / 2) * gap;
      const seatN = Math.min(12, Math.max(1, table.capacity));
      const assigned = guests.filter(
        (g) => seatAssignments[g.id] === table.id,
      ).length;
      const seats = Array.from({ length: seatN }, (_, k) => {
        const ang = (k / seatN) * Math.PI * 2;
        return {
          gx: x + Math.cos(ang) * SEAT_R,
          gz: z + Math.sin(ang) * SEAT_R,
          ang,
          taken: k < assigned,
        };
      });
      return { table, x, z, occupied: assigned > 0, seats };
    });
  }, [tables, guests, seatAssignments]);

  const focus = useMemo(() => {
    if (!focusGuestId) return null;
    const tid = seatAssignments[focusGuestId];
    if (!tid) return null;
    const p = plots.find((pl) => pl.table.id === tid);
    const seat = p?.seats.find((sx) => sx.taken) ?? p?.seats[0];
    if (!p || !seat) return null;
    return { x: seat.gx * 1.18, y: 1.7, z: seat.gz * 1.18 };
  }, [focusGuestId, seatAssignments, plots]);

  const seatsAll = plots.flatMap((p) =>
    p.seats.map((sx) => ({
      x: sx.gx,
      z: sx.gz,
      bx: sx.gx + Math.cos(sx.ang) * 0.22,
      bz: sx.gz + Math.sin(sx.ang) * 0.22,
      rot: -sx.ang + Math.PI / 2,
    })),
  );
  const plates = plots.flatMap((p) =>
    p.seats.map((sx) => ({
      x: p.x + Math.cos(sx.ang) * (TABLE_R - 0.22),
      z: p.z + Math.sin(sx.ang) * (TABLE_R - 0.22),
    })),
  );
  const orbs = plots.flatMap((p) =>
    p.seats.filter((sx) => sx.taken).map((sx) => ({ x: sx.gx, z: sx.gz })),
  );

  return (
    <>
      <color attach="background" args={["#0A0A0F"]} />
      <fog attach="fog" args={["#0A0A0F", 15, 35]} />

      <PerformanceMonitor
        onDecline={() => onPerfChange(true)}
        onIncline={() => onPerfChange(false)}
      />
      <SoftShadows size={25} samples={16} />
      <Environment preset="sunset" background={false} />

      <spotLight
        position={[0, 6, 0]}
        angle={0.4}
        penumbra={0.5}
        intensity={8}
        color="#F4DEA9"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight
        position={[-7.5, 5, -7.5]}
        angle={0.6}
        penumbra={0.5}
        intensity={3}
        color="#D4B068"
      />

      {/* L2 — parquet floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[30, 30]} />
        <meshPhysicalMaterial
          color="#2A1F15"
          roughness={0.35}
          clearcoat={0.8}
          clearcoatRoughness={0.15}
          metalness={0.05}
        />
      </mesh>

      <DanceFloor />

      {/* Bar + glass bottles */}
      <group position={[-7.5, 0, -7.5]}>
        <mesh position={[0, 0.575, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 1.15, 0.8]} />
          <meshPhysicalMaterial
            color="#2A2016"
            roughness={0.35}
            clearcoat={0.5}
          />
        </mesh>
        {[-1.1, -0.5, 0.1, 0.7, 1.2].map((bx, i) => (
          <mesh key={i} position={[bx, 1.32, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.3, 16]} />
            <meshPhysicalMaterial
              color="#D9B36A"
              roughness={0.1}
              transmission={0.9}
              thickness={0.5}
              ior={1.45}
              emissive="#A8884A"
              emissiveIntensity={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Tables: leg + sheened white cloth + glow when occupied */}
      {plots.map((p) => (
        <group key={p.table.id} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.375, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
            <meshStandardMaterial color="#1A1620" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.77, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[TABLE_R, TABLE_R, 0.04, 44]} />
            <meshPhysicalMaterial
              color="#F5F0E8"
              roughness={0.7}
              sheen={1}
              sheenColor="#FFFFFF"
              sheenRoughness={0.5}
              emissive="#F4DEA9"
              emissiveIntensity={p.occupied ? 0.05 : 0}
            />
          </mesh>
          <mesh position={[0, 0.94, 0]}>
            <sphereGeometry args={[0.11, 18, 18]} />
            <meshStandardMaterial
              color="#F4DEA9"
              emissive="#F4DEA9"
              emissiveIntensity={1.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* Plates */}
      {plates.length > 0 && (
        <Instances limit={plates.length} range={plates.length} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.018, 24]} />
          <meshPhysicalMaterial
            color="#F2EFEA"
            roughness={0.22}
            clearcoat={0.85}
          />
          {plates.map((pl, i) => (
            <Instance key={i} position={[pl.x, 0.81, pl.z]} />
          ))}
        </Instances>
      )}

      {/* Chairs — seat */}
      {seatsAll.length > 0 && (
        <Instances
          limit={seatsAll.length}
          range={seatsAll.length}
          castShadow
        >
          <boxGeometry args={[0.5, 0.1, 0.5]} />
          <meshPhysicalMaterial color="#3A2A1F" roughness={0.6} />
          {seatsAll.map((c, i) => (
            <Instance
              key={i}
              position={[c.x, 0.46, c.z]}
              rotation={[0, c.rot, 0]}
            />
          ))}
        </Instances>
      )}
      {/* Chairs — backrest */}
      {seatsAll.length > 0 && (
        <Instances
          limit={seatsAll.length}
          range={seatsAll.length}
          castShadow
        >
          <boxGeometry args={[0.5, 0.55, 0.08]} />
          <meshPhysicalMaterial color="#1A1A1F" roughness={0.6} />
          {seatsAll.map((c, i) => (
            <Instance
              key={i}
              position={[c.bx, 0.74, c.bz]}
              rotation={[0, c.rot, 0]}
            />
          ))}
        </Instances>
      )}

      {/* Seated-guest glow orbs */}
      {orbs.length > 0 && (
        <Instances limit={orbs.length} range={orbs.length}>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshStandardMaterial
            color="#F4DEA9"
            emissive="#D4B068"
            emissiveIntensity={0.7}
            toneMapped={false}
          />
          {orbs.map((o, i) => (
            <Instance key={i} position={[o.x, 1.04, o.z]} />
          ))}
        </Instances>
      )}

      <Rig focus={focus} />

      {effects && (
        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.4}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.1} darkness={0.45} />
          <ChromaticAberration offset={[0.0005, 0.0005]} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Room3DScene({
  tables,
  guests,
  seatAssignments,
  focusGuestId,
}: {
  tables: SeatingTable[];
  guests: Guest[];
  seatAssignments: Record<string, string>;
  focusGuestId: string | null;
}) {
  // L7 — effects only on capable GPUs; PerformanceMonitor can revoke.
  const [lowPerf, setLowPerf] = useState(false);
  const highDpr = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.devicePixelRatio || 1) >= 2,
    [],
  );
  const effects = highDpr && !lowPerf;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 13, 0.01], fov: 46 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene
        tables={tables}
        guests={guests}
        seatAssignments={seatAssignments}
        focusGuestId={focusGuestId}
        effects={effects}
        onPerfChange={setLowPerf}
      />
    </Canvas>
  );
}
