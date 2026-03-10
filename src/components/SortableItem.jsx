import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem({ id, children, disabled, isOver }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id,
        disabled
    });

    const style = {
        transform: transform ? CSS.Transform.toString(transform) : 'none',
        transition: transition || 'none',
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 1000 : (isOver ? 900 : 'auto'),
        position: isDragging ? 'relative' : 'static',
        touchAction: isDragging ? 'none' : 'auto',
        // Highlight Drop Target
        outline: isOver ? '3px solid #f59e0b' : 'none',
        borderRadius: isOver ? '12px' : '0',
        boxShadow: isOver ? '0 0 20px rgba(245, 158, 11, 0.5), inset 0 0 20px rgba(245, 158, 11, 0.2)' : 'none',
        background: isOver ? 'rgba(245, 158, 11, 0.15)' : 'none',
    };

    return (
        <div ref={setNodeRef} style={style}>
            {/* If children is a function, call it with drag props. Otherwise render as is (fallback) */}
            {typeof children === 'function'
                ? children({ attributes, listeners, isDragging })
                : React.cloneElement(children, { ...attributes, ...listeners })
            }
        </div>
    );
}
