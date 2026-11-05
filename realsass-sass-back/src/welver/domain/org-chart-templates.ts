/**
 * org-chart-templates.ts — plantillas de organigrama por tipo de municipio (welver-domain.md §13.2 «Onboarding»).
 *
 * Dominio puro. Son un punto de partida editable: el municipio las ajusta con sus nombres reales. La plantilla
 * sugerida sale del tramo de población (tiers.ts). Solo contienen estructura, nunca datos.
 */
import type { Tier } from '@/welver/domain/tiers';
import { SUGGESTED_MAX_DEPTH, siblingKey } from '@/welver/domain/org-tree';

export type TemplateKey = 'small' | 'medium' | 'large';

export interface TemplateNode {
  name: string;
  description?: string;
  children?: readonly TemplateNode[];
}

export interface OrgChartTemplate {
  key: TemplateKey;
  label: string;
  description: string;
  nodes: readonly TemplateNode[];
}

export const TEMPLATE_KEYS: readonly TemplateKey[] = [
  'small',
  'medium',
  'large',
];

export const ORG_CHART_TEMPLATES: Readonly<
  Record<TemplateKey, OrgChartTemplate>
> = {
  small: {
    key: 'small',
    label: 'Municipio chico',
    description:
      'Hasta 20.000 habitantes: pocas áreas, cada una con muchas funciones.',
    nodes: [
      {
        name: 'Intendencia',
        description: 'Atención general, audiencias y comunicación oficial.',
      },
      {
        name: 'Obras y Servicios Públicos',
        description:
          'Alumbrado, bacheo, recolección, espacios verdes y permisos de obra.',
      },
      {
        name: 'Salud',
        description: 'Salas de atención primaria, vacunación y turnos.',
      },
      {
        name: 'Rentas y Tasas',
        description:
          'Tasas municipales, planes de pago y habilitaciones comerciales.',
      },
      {
        name: 'Acción Social',
        description: 'Asistencia, programas sociales y tercera edad.',
      },
      {
        name: 'Cultura, Turismo y Deportes',
        description: 'Eventos, talleres, biblioteca y polideportivo.',
      },
      {
        name: 'Tránsito',
        description: 'Licencias de conducir, infracciones y transporte.',
      },
    ],
  },
  medium: {
    key: 'medium',
    label: 'Municipio mediano',
    description:
      'De 20.000 a 100.000 habitantes: secretarías con direcciones propias.',
    nodes: [
      { name: 'Intendencia' },
      {
        name: 'Secretaría de Obras Públicas',
        children: [
          { name: 'Obras Particulares' },
          { name: 'Servicios Públicos' },
          { name: 'Espacios Verdes' },
        ],
      },
      {
        name: 'Secretaría de Salud',
        children: [
          { name: 'Atención Primaria' },
          { name: 'Zoonosis' },
          { name: 'Bromatología' },
        ],
      },
      {
        name: 'Secretaría de Hacienda',
        children: [
          { name: 'Rentas' },
          { name: 'Comercio e Industria' },
          { name: 'Compras' },
        ],
      },
      {
        name: 'Secretaría de Desarrollo Social',
        children: [
          { name: 'Niñez y Familia' },
          { name: 'Adultos Mayores' },
          { name: 'Empleo' },
        ],
      },
      {
        name: 'Secretaría de Cultura y Deportes',
        children: [
          { name: 'Cultura' },
          { name: 'Deportes' },
          { name: 'Turismo' },
        ],
      },
      {
        name: 'Secretaría de Tránsito y Seguridad',
        children: [
          { name: 'Licencias de Conducir' },
          { name: 'Infracciones' },
          { name: 'Defensa Civil' },
        ],
      },
    ],
  },
  large: {
    key: 'large',
    label: 'Municipio grande',
    description:
      'Más de 100.000 habitantes: secretarías con subsecretarías y direcciones.',
    nodes: [
      { name: 'Intendencia' },
      {
        name: 'Secretaría de Obras y Servicios Públicos',
        children: [
          {
            name: 'Subsecretaría de Obras',
            children: [
              { name: 'Obras Particulares' },
              { name: 'Obras Públicas' },
              { name: 'Catastro' },
            ],
          },
          {
            name: 'Subsecretaría de Servicios',
            children: [
              { name: 'Alumbrado' },
              { name: 'Higiene Urbana' },
              { name: 'Espacios Verdes' },
            ],
          },
        ],
      },
      {
        name: 'Secretaría de Salud',
        children: [
          {
            name: 'Atención Primaria',
            children: [{ name: 'Centros de Salud' }, { name: 'Vacunación' }],
          },
          {
            name: 'Salud Pública',
            children: [
              { name: 'Zoonosis' },
              { name: 'Bromatología' },
              { name: 'Epidemiología' },
            ],
          },
        ],
      },
      {
        name: 'Secretaría de Hacienda',
        children: [
          {
            name: 'Rentas',
            children: [
              { name: 'Tasas y Contribuciones' },
              { name: 'Planes de Pago' },
            ],
          },
          {
            name: 'Comercio e Industria',
            children: [{ name: 'Habilitaciones' }, { name: 'Inspección' }],
          },
          { name: 'Compras y Licitaciones' },
        ],
      },
      {
        name: 'Secretaría de Desarrollo Social',
        children: [
          { name: 'Niñez, Adolescencia y Familia' },
          { name: 'Adultos Mayores' },
          { name: 'Género y Diversidad' },
          { name: 'Empleo y Capacitación' },
        ],
      },
      {
        name: 'Secretaría de Cultura, Turismo y Deportes',
        children: [
          { name: 'Cultura' },
          { name: 'Turismo' },
          { name: 'Deportes' },
          { name: 'Juventud' },
        ],
      },
      {
        name: 'Secretaría de Movilidad y Seguridad',
        children: [
          {
            name: 'Tránsito',
            children: [
              { name: 'Licencias de Conducir' },
              { name: 'Infracciones' },
            ],
          },
          { name: 'Transporte' },
          { name: 'Defensa Civil' },
        ],
      },
      {
        name: 'Secretaría de Ambiente y Planeamiento',
        children: [{ name: 'Medio Ambiente' }, { name: 'Planeamiento Urbano' }],
      },
    ],
  },
};

export function suggestedTemplateForTier(tier: Tier): TemplateKey {
  if (tier === 1) return 'small';
  if (tier === 2) return 'medium';
  return 'large';
}

export function isTemplateKey(value: string): value is TemplateKey {
  return TEMPLATE_KEYS.some((k) => k === value);
}

export interface FlatTemplateNode {
  /** Índice estable dentro de la plantilla. */
  index: number;
  parentIndex: number | null;
  name: string;
  description: string | null;
  sortOrder: number;
  depth: number;
}

/** Plantilla en lista plana, padres antes que hijos. */
export function flattenTemplate(
  template: OrgChartTemplate,
): FlatTemplateNode[] {
  const result: FlatTemplateNode[] = [];
  const visit = (
    nodes: readonly TemplateNode[],
    parentIndex: number | null,
    depth: number,
  ): void => {
    nodes.forEach((node, sortOrder) => {
      const index = result.length;
      result.push({
        index,
        parentIndex,
        name: node.name,
        description: node.description ?? null,
        sortOrder,
        depth,
      });
      if (node.children) visit(node.children, index, depth + 1);
    });
  };
  visit(template.nodes, null, 1);
  return result;
}

/** Problemas estructurales de una plantilla (nombres repetidos entre hermanos, profundidad). Vacío = válida. */
export function validateTemplate(template: OrgChartTemplate): string[] {
  const problems: string[] = [];
  const check = (
    nodes: readonly TemplateNode[],
    depth: number,
    where: string,
  ): void => {
    const seen = new Set<string>();
    for (const node of nodes) {
      const key = siblingKey(node.name);
      if (seen.has(key))
        problems.push(`${where}: «${node.name}» está repetido entre hermanos`);
      seen.add(key);
      if (depth > SUGGESTED_MAX_DEPTH)
        problems.push(
          `${where} › ${node.name}: supera ${SUGGESTED_MAX_DEPTH} niveles`,
        );
      if (node.children)
        check(node.children, depth + 1, `${where} › ${node.name}`);
    }
  };
  check(template.nodes, 1, template.key);
  return problems;
}
