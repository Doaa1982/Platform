import React from 'react';
import PropTypes from 'prop-types';
import './AnimatedButton.css';

/**
 * AnimatedButton wraps a native button element with the `button-animated`
 * utility class defined in the design system. Supports variants:
 * - 'primary': Solid Speechmatics cyan (#00A3BF) with smooth hover elevation
 * - 'outline': Clean cyan border with translucent cyan hover fill
 * - 'ghost': Sleek dark translucent button with subtle border
 */
export default function AnimatedButton({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}) {
  const variantClass = variant === 'outline'
    ? 'button-animated--outline'
    : variant === 'ghost'
    ? 'button-animated--ghost'
    : '';

  const combinedClass = ['button-animated', variantClass, className].filter(Boolean).join(' ');

  return (
    <button type={type} className={combinedClass} {...rest}>
      {children}
    </button>
  );
}

AnimatedButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'outline', 'ghost']),
  className: PropTypes.string,
  type: PropTypes.string,
};
