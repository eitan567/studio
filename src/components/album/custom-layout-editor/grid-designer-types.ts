import { Point } from '@/lib/advanced-layout-types';

export type GridDesignerMode = 'move' | 'delete' | 'add-horizontal' | 'add-vertical';

export type GridDesignerSegment = {
    id: string;
    orientation: 'horizontal' | 'vertical';
    p1: Point;
    p2: Point;
    active: boolean;
};
