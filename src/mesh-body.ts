import * as THREE from 'three'

const prefix = 'mannequin_'
const geometry = new THREE.SphereGeometry(1, 20, 14)
const material = new THREE.MeshPhongMaterial({
    color: 0xb7a9d6,
    shininess: 35,
})
const up = new THREE.Vector3(0, 1, 0)

export function IsMeshBodyPart(object: THREE.Object3D) {
    return object.name.startsWith(prefix)
}

export function HasMeshBody(body: THREE.Object3D) {
    return body.userData.meshBody === true
}

function addPart(parent: THREE.Object3D, name: string) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = prefix + name
    parent.add(mesh)
    return mesh
}

export function SetMeshBody(body: THREE.Object3D, enabled: boolean) {
    const existing: THREE.Object3D[] = []
    body.traverse((part) => {
        if (IsMeshBodyPart(part)) existing.push(part)
    })
    existing.forEach((part) => part.removeFromParent())
    body.userData.meshBody = enabled
    if (!enabled) return

    for (const side of ['left', 'right']) {
        for (const [start, end] of [
            ['shoulder', 'elbow'],
            ['elbow', 'wrist'],
            ['hip', 'knee'],
            ['knee', 'ankle'],
        ]) {
            const joint = body.getObjectByName(`${side}_${start}`)!
            const segment = addPart(joint, `${side}_${start}`)
            segment.userData.endJoint = `${side}_${end}`
            addPart(joint, `${side}_${start}_joint`)
        }
    }
    const torso = body.getObjectByName('five')!
    for (const name of ['chest', 'waist', 'pelvis']) addPart(torso, name)
    const neck = body.getObjectByName('neck')!
    addPart(neck, 'neck')
    addPart(body.getObjectByName('nose')!, 'head')
    UpdateMeshBody(body)
}

/** Fit local meshes to the current joint positions, including resized limbs. */
export function UpdateMeshBody(body: THREE.Object3D) {
    if (!HasMeshBody(body)) return
    const joint = (name: string) => body.getObjectByName(name)!
    const shoulderWidth = joint('left_shoulder').position.distanceTo(
        joint('right_shoulder').position
    )
    const hipWidth = Math.abs(
        joint('left_hip').position.x - joint('right_hip').position.x
    )
    const height = Math.abs(
        (joint('left_hip').position.y + joint('right_hip').position.y) / 2
    )
    const torso = joint('five')
    const shape = (
        name: string,
        y: number,
        x: number,
        sy: number,
        z: number
    ) => {
        const mesh = torso.getObjectByName(prefix + name)!
        mesh.position.set(0, y, 0)
        mesh.scale.set(x, sy, z)
    }
    shape(
        'chest',
        -height * 0.26,
        shoulderWidth * 0.52,
        height * 0.36,
        shoulderWidth * 0.28
    )
    shape(
        'waist',
        -height * 0.61,
        shoulderWidth * 0.34,
        height * 0.25,
        shoulderWidth * 0.22
    )
    shape(
        'pelvis',
        -height * 0.86,
        Math.max(hipWidth * 0.72, shoulderWidth * 0.38),
        height * 0.22,
        shoulderWidth * 0.27
    )

    const nose = joint('nose')
    const head = nose.getObjectByName(prefix + 'head')!
    const headSize = Math.max(
        joint('left_eye')
            .position.clone()
            .add(joint('left_ear').position)
            .distanceTo(
                joint('right_eye')
                    .position.clone()
                    .add(joint('right_ear').position)
            ) * 0.65,
        1
    )
    head.position.set(0, 0, -headSize)
    head.scale.set(headSize, headSize * 1.35, headSize * 1.1)
    const neck = joint('neck').getObjectByName(prefix + 'neck')!
    neck.position.set(0, nose.position.y * 0.25, 0)
    neck.scale.set(
        headSize * 0.48,
        Math.max(nose.position.y * 0.3, 1),
        headSize * 0.48
    )

    body.traverse((part) => {
        if (!IsMeshBodyPart(part) || !part.userData.endJoint) return
        const end = joint(part.userData.endJoint)
        const direction = end.position.clone()
        const length = direction.length()
        const leg = /hip|knee/.test(part.parent!.name)
        const upper = /hip|shoulder/.test(part.parent!.name)
        const radius =
            shoulderWidth * (leg ? (upper ? 0.19 : 0.14) : upper ? 0.115 : 0.09)
        part.position.copy(direction).multiplyScalar(0.5)
        if (length > 0)
            part.quaternion.setFromUnitVectors(up, direction.normalize())
        part.scale.set(radius, length * 0.56, radius)
        part.parent!.getObjectByName(part.name + '_joint')!.scale.setScalar(
            radius * 0.95
        )
    })
}
