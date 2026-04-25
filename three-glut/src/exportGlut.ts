import type { SceneObject, Space } from './scene'

const toVec = (values: number[]) => values.map((value) => value.toFixed(3)).join(', ')

const sanitizeName = (name: string, fallback: string) => {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed.replace(/[^a-zA-Z0-9_]/g, '_') : fallback
}

export const exportGlutProgram = (space: Space, objects: SceneObject[]) => {
  const lines: string[] = []

  lines.push('#include <GL/glut.h>')
  lines.push('')
  lines.push('void drawScene() {')

  if (objects.length === 0) {
    lines.push('  // No objects selected for export.')
  }

  objects.forEach((object, index) => {
    const name = sanitizeName(object.name, `object_${index + 1}`)
    const color = toVec(object.color)
    const position = toVec(object.position)
    const rotation = toVec(object.rotation)
    const scale = toVec(object.scale)

    lines.push(`  // ${name}`)
    lines.push(`  glColor3f(${color});`)
    lines.push('  glPushMatrix();')
    lines.push(`  glTranslatef(${position});`)
    lines.push(`  glRotatef(${rotation.split(', ')[0]}, 1.0f, 0.0f, 0.0f);`)
    lines.push(`  glRotatef(${rotation.split(', ')[1]}, 0.0f, 1.0f, 0.0f);`)
    lines.push(`  glRotatef(${rotation.split(', ')[2]}, 0.0f, 0.0f, 1.0f);`)
    lines.push(`  glScalef(${scale});`)

    if (space === '2d') {
      lines.push('  glBegin(GL_LINE_LOOP);')
      lines.push('  glVertex2f(-0.5f, -0.5f);')
      lines.push('  glVertex2f(0.5f, -0.5f);')
      lines.push('  glVertex2f(0.5f, 0.5f);')
      lines.push('  glVertex2f(-0.5f, 0.5f);')
      lines.push('  glEnd();')
    } else {
      lines.push('  glutSolidCube(1.0);')
    }

    lines.push('  glPopMatrix();')
    lines.push('')
  })

  lines.push('}')

  return lines.join('\n')
}
