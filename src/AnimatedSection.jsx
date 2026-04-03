import { motion } from 'motion/react';

/**
 * AnimatedSection - 通用滚动入场动画组件
 * 
 * 功能：元素进入视口时执行淡入+上浮微动画
 * 
 * 动画参数：
 * - duration: 动画时长（秒），默认 0.5s
 * - delay: 延迟时间（秒），默认 0
 * - y: Y轴位移，默认 24px
 * - threshold: 触发阈值，默认 0.1 (10% 可见时触发)
 */
export function AnimatedSection({ 
  children, 
  className = '',
  duration = 0.5,
  delay = 0,
  y = 24,
  threshold = 0.1,
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: threshold }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1] // Apple-style ease curve
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - 子元素交错动画容器
 * 
 * 功能：让子元素按顺序依次入场
 * 
 * 动画参数：
 * - staggerChildren: 子元素间隔（秒），默认 0.08s
 * - delayChildren: 整体延迟（秒），默认 0
 */
export function StaggerContainer({ 
  children, 
  className = '',
  staggerChildren = 0.08,
  delayChildren = 0,
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren,
            delayChildren,
            ease: [0.25, 0.1, 0.25, 1]
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - 配合 StaggerContainer 的子项
 */
export function StaggerItem({ 
  children, 
  className = '',
  y = 16,
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{
        hidden: { opacity: 0, y },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1]
          }
        }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * FadeIn - 简单淡入动画
 */
export function FadeIn({ 
  children, 
  className = '',
  duration = 0.4,
  delay = 0,
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleIn - 缩放入场动画
 */
export function ScaleIn({ 
  children, 
  className = '',
  duration = 0.4,
  delay = 0,
  scale = 0.95,
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Pressable - 带按压反馈的包装组件
 * 
 * 功能：点击时有轻微缩放反馈
 */
export function Pressable({ 
  children, 
  className = '',
  onClick,
  whileTap = { scale: 0.98 },
  style = {}
}) {
  return (
    <motion.div
      className={className}
      style={style}
      onClick={onClick}
      whileTap={whileTap}
      transition={{ duration: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatePresence 导出，方便外部使用
 */
export { AnimatePresence } from 'motion/react';
