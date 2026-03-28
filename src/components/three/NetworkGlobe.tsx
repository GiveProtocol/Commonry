import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function NetworkGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.FogExp2(0x050505, 0.06);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 14;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Globe group
    const globeGroup = new THREE.Group();
    globeGroup.rotation.x = 0.3;
    globeGroup.rotation.z = 0.1;
    scene.add(globeGroup);

    // Wireframe sphere
    const sphereGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x440000,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    globeGroup.add(sphereMesh);

    // Fibonacci-distributed nodes
    const nodeCount = 120;
    const nodeRadius = 5.1;
    const nodePositions: THREE.Vector3[] = [];
    const nodeColors = [
      { color: 0x00f0ff, weight: 40 },
      { color: 0xffaa00, weight: 25 },
      { color: 0xff3333, weight: 20 },
      { color: 0x555555, weight: 15 },
    ];

    const colorPool: number[] = [];
    for (const { color, weight } of nodeColors) {
      for (let i = 0; i < weight; i++) {
        colorPool.push(color);
      }
    }

    const nodeGeometries: THREE.BufferGeometry[] = [];
    const nodeMaterials: THREE.MeshBasicMaterial[] = [];

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const pos = new THREE.Vector3(
        x * nodeRadius,
        y * nodeRadius,
        z * nodeRadius,
      );
      nodePositions.push(pos);

      const nodeGeo = new THREE.SphereGeometry(0.06, 8, 8);
      const pickedColor =
        colorPool[Math.floor(Math.random() * colorPool.length)];
      const nodeMat = new THREE.MeshBasicMaterial({ color: pickedColor });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      nodeMesh.position.copy(pos);
      globeGroup.add(nodeMesh);

      nodeGeometries.push(nodeGeo);
      nodeMaterials.push(nodeMat);
    }

    // Network lines between nearby nodes
    const lineThreshold = 3.5;
    const linePoints: number[] = [];

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (nodePositions[i].distanceTo(nodePositions[j]) < lineThreshold) {
          linePoints.push(
            nodePositions[i].x,
            nodePositions[i].y,
            nodePositions[i].z,
            nodePositions[j].x,
            nodePositions[j].y,
            nodePositions[j].z,
          );
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePoints, 3),
    );
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15,
    });
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    globeGroup.add(lineSegments);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.8;
    controls.enableZoom = false;
    controls.enablePan = false;

    // Animation loop
    let frameId: number;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    function handleResize() {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    // Cleanup (handles StrictMode double-mount)
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();

      // Dispose geometries and materials
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      for (const g of nodeGeometries) g.dispose();
      for (const m of nodeMaterials) m.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
