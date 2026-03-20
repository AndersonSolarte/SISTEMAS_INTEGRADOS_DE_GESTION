/**
 * motion.js — Variantes y componentes reutilizables de Framer Motion.
 * Uso: import { FadeIn, SlideUp, StaggerList, StaggerItem } from '../theme/motion';
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Variantes base ────────────────────────────────────────── */
export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:   { opacity: 0, transition: { duration: 0.15 } },
};

export const slideUpVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: 8, transition: { duration: 0.18 } },
};

export const slideRightVariants = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, x: 10, transition: { duration: 0.15 } },
};

export const scaleInVariants = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

export const staggerContainerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const staggerItemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

/* ── Componentes pre-configurados ──────────────────────────── */

/** Aparece con fade */
export const FadeIn = ({ children, delay = 0, style, ...props }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    exit="exit"
    variants={fadeInVariants}
    transition={{ delay }}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);

/** Sube y aparece */
export const SlideUp = ({ children, delay = 0, style, ...props }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    exit="exit"
    variants={slideUpVariants}
    transition={{ delay }}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);

/** Escala y aparece */
export const ScaleIn = ({ children, delay = 0, style, ...props }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    exit="exit"
    variants={scaleInVariants}
    transition={{ delay }}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);

/** Contenedor que anima hijos en cascada */
export const StaggerList = ({ children, style, ...props }) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={staggerContainerVariants}
    style={style}
    {...props}
  >
    {children}
  </motion.div>
);

/** Item hijo de StaggerList */
export const StaggerItem = ({ children, style, ...props }) => (
  <motion.div variants={staggerItemVariants} style={style} {...props}>
    {children}
  </motion.div>
);

/** Wrapper de AnimatePresence para transiciones de página */
export const PageTransition = ({ children, keyProp }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={keyProp}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      style={{ width: '100%', height: '100%' }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

/** Tarjeta con hover lift */
export const MotionCard = motion.div;

export const cardHoverProps = {
  whileHover: { y: -3, boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.12)' },
  whileTap:   { scale: 0.985 },
  transition: { duration: 0.2, ease: 'easeOut' },
};
