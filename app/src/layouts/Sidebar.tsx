import { ReactNode, useCallback, useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";

const SIDEBAR_W = 320;
const EDGE_W = 16;

interface Props {
  children: ReactNode;
  content: ReactNode;
}

export const SidebarLayout = (props: Props) => {
  const [open, setOpen] = useState(false);

  const x = useMotionValue(-SIDEBAR_W);
  const edgeX = useMotionValue(0);

  const overlayOpacity = useTransform(x, [-SIDEBAR_W, 0], [0, 0.5]);

  const snapTo = useCallback(
    (toOpen: boolean) => {
      setOpen(toOpen);
      animate(x, toOpen ? 0 : -SIDEBAR_W, {
        type: "spring",
        stiffness: 450,
        damping: 40,
      });
    },
    [x]
  );

  useEffect(() => {
    animate(x, open ? 0 : -SIDEBAR_W, {
      type: "spring",
      stiffness: 450,
      damping: 40,
    });
  }, [open, x]);

  const decideOpen = useCallback(
    (info: { offset: { x: number }; velocity: { x: number } }) => {
      const shouldOpen =
        info.offset.x > SIDEBAR_W * 0.35 || info.velocity.x > 600;
      snapTo(shouldOpen);
    },
    [snapTo]
  );

  return (
    <>
      {/* overlay */}
      <motion.div
        style={{
          position: "fixed",
          inset: 0,
          background: "black",
          opacity: overlayOpacity,
          pointerEvents: open ? "auto" : "none",
          zIndex: 40,
        }}
        onClick={() => snapTo(false)}
      />

      {/* 左端ヒットエリア */}
      <motion.div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: EDGE_W,
          height: "100vh",
          zIndex: 50,
          touchAction: "pan-y",
          x: edgeX,
        }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: SIDEBAR_W }}
        dragElastic={0}
        dragMomentum={false}
        onDrag={(_, info) => {
          const next = Math.min(0, -SIDEBAR_W + info.offset.x);
          x.set(next);
        }}
        onDragEnd={(_, info) => {
          decideOpen(info);
          animate(edgeX, 0, { type: "spring", stiffness: 700, damping: 45 });
        }}
      />

      {/* sidebar */}
      <motion.aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          width: SIDEBAR_W,
          x,
          zIndex: 60,
          background: "white",
          touchAction: "none",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -SIDEBAR_W, right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={(_, info) => decideOpen(info)}
      >
        {props.content}
      </motion.aside>

      <div style={{ width: "100%", height: "100%" }}>{props.children}</div>
    </>
  );
};

