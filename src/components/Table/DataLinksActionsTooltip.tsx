import React, { ReactNode } from 'react';
import { css } from '@emotion/css';

import { ActionModel, GrafanaTheme2, LinkModel } from '@grafana/data';
import { useStyles2, useTheme2, Portal } from '@grafana/ui';

import { DataLinksActionsTooltipCoords } from './utils';

interface Props {
  links: LinkModel[];
  actions?: ActionModel[];
  value?: ReactNode;
  coords: DataLinksActionsTooltipCoords;
  onTooltipClose?: () => void;
}

/**
 *
 * @internal
 */
export const DataLinksActionsTooltip = ({ links, actions, value, coords, onTooltipClose }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  if (links.length === 0 && !Boolean(actions?.length)) {
    return null;
  }

  return (
    <>
      {value}
      <Portal>
        <div
          style={{
            position: 'fixed',
            left: coords.clientX,
            top: coords.clientY,
            zIndex: theme.zIndex.tooltip,
          }}
          className={styles.tooltipWrapper}
        >
          <div className={styles.content}>
            {links.map((link, index) => (
              <div key={index} className={styles.linkItem}>
                <a
                  href={link.href}
                  onClick={link.onClick}
                  target={link.target}
                  title={link.title}
                  className={styles.link}
                >
                  {link.title}
                </a>
              </div>
            ))}
            {actions && actions.map((action, index) => (
              <div key={`action-${index}`} className={styles.linkItem}>
                <button
                  onClick={action.onClick}
                  className={styles.actionButton}
                >
                  {action.title || 'Action'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Portal>
    </>
  );
};

export const renderSingleLink = (link: LinkModel, children: ReactNode, className?: string): ReactNode => {
  return (
    <a
      href={link.href}
      onClick={link.onClick}
      target={link.target}
      title={link.title}
      className={className}
    >
      {children}
    </a>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tooltipWrapper: css({
      whiteSpace: 'pre',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z3,
      userSelect: 'text',
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(1),
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    linkItem: css({
      padding: theme.spacing(0.5, 1),
    }),
    link: css({
      color: theme.colors.text.link,
      textDecoration: 'none',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    actionButton: css({
      background: 'transparent',
      border: 'none',
      color: theme.colors.text.link,
      cursor: 'pointer',
      padding: 0,
      textAlign: 'left',
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
