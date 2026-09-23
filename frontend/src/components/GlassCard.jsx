import React from 'react';

/**
 * GlassCard component applies the .glass-card utility class for a glassmorphism effect.
 * It forwards any additional className props and other HTML attributes.
 */
export default function GlassCard({ children, className = '', ...rest }) {
  const combinedClass = ['glass-card', className].filter(Boolean).join(' ');
  return (
    <div className={combinedClass} {...rest}>
      {children}
    </div>
  );
}

