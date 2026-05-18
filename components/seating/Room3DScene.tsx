"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Instances,
  Instance,
  Environment,
  Lightformer,
  ContactShadows,
  MeshReflectorMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import type { Guest, SeatingTable } from "@/lib/types";

/**
 * R44/R45 · Feature 3 — ROOM, photoreal pass.
 *
 * Pulled ONLY through Room3D's dynamic ssr:false import, so three.js
 * stays out of the main bundle. "Photoreal" here = a physically-based
 * material + lighting setup (no extra postprocessing dep needed):
 *
 *  • ACES-filmic tone mapping + tuned exposure (cinematic response)
 *  • a soft studio Environment built from <Lightformer>s (reflections
 *    + ambient bounce, computed once, NO external HDRI fetch)
 *  • a polished, subtly-mirrored floor (MeshReflectorMaterial)
 *  • baked soft ContactShadows (grounded look at a fraction of the
 *    cost of realtime shadow maps)
 *  • rounded geometry + clear-coat / rough PBR surfaces, draped white
 *    tablecloths, glowing centerpieces, instanced chairs & plates
 *
 * Heavier than the old flat pass (the owner explicitly asked for
 * quality) but still lazy/opt-in; dpr is capped and shadows are baked
 * once so it holds up on mid-range mobile.
 */

interface TablePlot {
  table: SeatingTable;
  x: number;
  z: number;
  seats: { gx: number; gz: number; ang: number; occupied: boolean }[];
}

const TABLE_R = 0.95;
const SEAT_R = 1.55;
const EYE = 1.7;

function StudioEnv() {
  // A small soft-box rig → believable reflections + fill, no CDN HDRI.
  return (
    <Environment resolution={256}>
      <group>
        <Lightformer
          intensity={2.4}
          color="#FFE9C6"
          position={[0, 6, -4]}
          scale={[12, 6, 1]}
        />
        <Lightformer
          intensity={1.2}
          color="#F4DEA9"
          position={[-7, 3, 5]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          intensity={1.0}
          color="#A8C0E0"
          position={[7, 3, 5]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          intensity={1.6}
          color="#ffffff"
          position={[0, 9, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 14, 1]}
        />
      </group>
    </Environment>
  );
}

function DanceFloor() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (ref.current)
      ref.current.emissiveIntensity =
        0.5 + 0.35 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.5));
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
      <planeGeometry args={[5.4, 5.4]} />
      <meshStandardMaterial
        ref={ref}
        color="#8A6E3C"
        emissive="#F4DEA9"
        emissiveIntensity={0.55}
        roughness={0.25}
        metalness={0.5}
      />
    </mesh>
  );
}

function CameraRig({
  focus,
}: {
  focus: { x: number; y: number; z: number } | null;
}) {
  const tgt = useRef(new THREE.Vector3());
  useFrame((s) => {
    if (!focus) return;
    tgt.current.set(focus.x, focus.y, focus.z);
    s.camera.position.lerp(tgt.current, 0.055);
    s.camera.lookAt(0, 1.05, 0);
  });
  return null;
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
  const plots = useMemo<TablePlot[]>(() => {
    const n = tables.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gap = 3.7;
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
          occupied: k < assigned,
        };
      });
      return { table, x, z, seats };
    });
  }, [tables, guests, seatAssignments]);

  const focus = useMemo(() => {
    if (!focusGuestId) return null;
    const tid = seatAssignments[focusGuestId];
    if (!tid) return null;
    const p = plots.find((pl) => pl.table.id === tid);
    const seat = p?.seats.find((sx) => sx.occupied) ?? p?.seats[0];
    if (!p || !seat) return null;
    return { x: seat.gx * 1.18, y: EYE, z: seat.gz * 1.18 };
  }, [focusGuestId, seatAssignments, plots]);

  const chairs = plots.flatMap((p) =>
    p.seats.map((sx) => ({ x: sx.gx, z: sx.gz, ang: sx.ang })),
  );
  const plates = plots.flatMap((p) =>
    p.seats.map((sx) => ({
      x: p.x + Math.cos(sx.ang) * (TABLE_R - 0.22),
      z: p.z + Math.sin(sx.ang) * (TABLE_R - 0.22),
    })),
  );
  const occupied = plots.flatMap((p) =>
    p.seats
      .filter((sx) => sx.occupied)
      .map((sx) => ({ x: sx.gx, z: sx.gz })),
  );

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: [0, 8.5, 12], fov: 46 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0B0A0C"]} />
      <fog attach="fog" args={["#0B0A0C", 22, 46]} />

      <ambientLight intensity={0.18} />
      <directionalLight position={[6, 11, 5]} intensity={0.5} color="#FFE9C2" />
      <StudioEnv />

      {/* Polished, faintly mirrored hall floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[70, 70]} />
        <MeshReflectorMaterial
          resolution={512}
          mixBlur={1}
          mixStrength={2.2}
          blur={[320, 110]}
          mirror={0.42}
          color="#15131A"
          metalness={0.65}
          roughness={0.85}
          depthScale={1}
        />
      </mesh>

      <DanceFloor />

      {/* Soft grounded shadow — baked once, very cheap */}
      <ContactShadows
        position={[0, 0.012, 0]}
        scale={48}
        blur={2.6}
        opacity={0.5}
        far={9}
        frames={1}
      />

      {/* Bar */}
      <group position={[-7.5, 0, -7.5]}>
        <RoundedBox
          args={[3.2, 1.15, 0.8]}
          radius={0.06}
          position={[0, 0.575, 0]}
        >
          <meshPhysicalMaterial
            color="#2A2016"
            roughness={0.35}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </RoundedBox>
        <mesh position={[0, 1.17, 0]}>
          <boxGeometry args={[3.3, 0.06, 0.9]} />
          <meshPhysicalMaterial
            color="#0E0D10"
            roughness={0.15}
            metalness={0.4}
            clearcoat={1}
          />
        </mesh>
        {[-1.1, -0.5, 0.1, 0.7, 1.2].map((bx, i) => (
          <mesh key={i} position={[bx, 1.42, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.34, 12]} />
            <meshPhysicalMaterial
              color="#D9B36A"
              roughness={0.05}
              metalness={0.2}
              transmission={0.6}
              thickness={0.4}
              emissive="#A8884A"
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}
      </group>

      {/* Tables: pedestal + cloth + draped skirt + glowing centerpiece */}
      {plots.map((p) => (
        <group key={p.table.id} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.74, 16]} />
            <meshStandardMaterial
              color="#1A1620"
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
          {/* skirt to the floor */}
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[TABLE_R * 0.86, TABLE_R, 0.74, 40, 1, true]} />
            <meshPhysicalMaterial
              color="#F3EFE6"
              roughness={0.85}
              sheen={1}
              sheenColor="#FFF7E8"
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* tabletop cloth */}
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[TABLE_R, TABLE_R, 0.06, 40]} />
            <meshPhysicalMaterial
              color="#FBF7EE"
              roughness={0.8}
              sheen={1}
              sheenColor="#FFF7E8"
            />
          </mesh>
          {/* centerpiece glow */}
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial
              color="#F4DEA9"
              emissive="#F4DEA9"
              emissiveIntensity={1.4}
            />
          </mesh>
          <pointLight
            position={[0, 1.05, 0]}
            intensity={0.22}
            distance={3}
            color="#F4DEA9"
          />
        </group>
      ))}

      {/* Plates — one instanced mesh for all settings */}
      {plates.length > 0 && (
        <Instances limit={plates.length} range={plates.length}>
          <cylinderGeometry args={[0.16, 0.16, 0.018, 24]} />
          <meshPhysicalMaterial
            color="#F2EFEA"
            roughness={0.25}
            clearcoat={0.8}
          />
          {plates.map((pl, i) => (
            <Instance key={i} position={[pl.x, 0.79, pl.z]} />
          ))}
        </Instances>
      )}

      {/* Chairs — instanced, rounded, upholstered */}
      {chairs.length > 0 && (
        <Instances limit={chairs.length} range={chairs.length}>
          <boxGeometry args={[0.46, 0.52, 0.46]} />
          <meshPhysicalMaterial
            color="#3A2E22"
            roughness={0.55}
            clearcoat={0.4}
            clearcoatRoughness={0.5}
          />
          {chairs.map((c, i) => (
            <Instance
              key={i}
              position={[c.x, 0.26, c.z]}
              rotation={[0, -c.ang + Math.PI / 2, 0]}
            />
          ))}
        </Instances>
      )}

      {/* Seated-guest markers — soft glowing orbs */}
      {occupied.length > 0 && (
        <Instances limit={occupied.length} range={occupied.length}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <meshStandardMaterial
            color="#F4DEA9"
            emissive="#D4B068"
            emissiveIntensity={0.7}
            roughness={0.2}
            metalness={0.3}
          />
          {occupied.map((o, i) => (
            <Instance key={i} position={[o.x, 1.02, o.z]} />
          ))}
        </Instances>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={34}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={[0, 0.7, 0]}
        enabled={!focus}
      />
      <CameraRig focus={focus} />
    </Canvas>
  );
}
