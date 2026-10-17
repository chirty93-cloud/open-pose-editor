import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import {
    HasMeshBody,
    IsMeshBodyPart,
    SetMeshBody,
    UpdateMeshBody,
} from '../src/mesh-body'

function skeleton() {
    const body = new THREE.Group()
    const joint = (
        parent: THREE.Object3D,
        name: string,
        x = 0,
        y = 0,
        z = 0
    ) => {
        const group = new THREE.Group()
        group.name = name
        group.position.set(x, y, z)
        parent.add(group)
        return group
    }
    const torso = joint(body, 'five')
    const neck = joint(torso, 'neck')
    const nose = joint(neck, 'nose', 0, 20, 14)
    for (const [side, sign] of [
        ['left', 1],
        ['right', -1],
    ] as const) {
        const eye = joint(nose, `${side}_eye`, sign * 3, 3, -3)
        joint(eye, `${side}_ear`, sign * 4, -3, -8)
        const shoulder = joint(torso, `${side}_shoulder`, sign * 17)
        const elbow = joint(shoulder, `${side}_elbow`, 0, -25)
        joint(elbow, `${side}_wrist`, 0, -25)
        const hip = joint(torso, `${side}_hip`, sign * 10, -46)
        const knee = joint(hip, `${side}_knee`, 0, -40)
        joint(knee, `${side}_ankle`, 0, -36)
    }
    return body
}

function meshes(body: THREE.Object3D) {
    const parts: THREE.Object3D[] = []
    body.traverse((part) => {
        if (IsMeshBodyPart(part)) parts.push(part)
    })
    return parts
}

test('attachment is repeatable and removable without removing joints', () => {
    const body = skeleton()
    SetMeshBody(body, true)
    SetMeshBody(body, true)
    assert.equal(HasMeshBody(body), true)
    assert.equal(meshes(body).length, 21)
    SetMeshBody(body, false)
    assert.equal(HasMeshBody(body), false)
    assert.equal(meshes(body).length, 0)
    assert.ok(body.getObjectByName('left_elbow'))
})

test('a limb follows joint rotation and proportion changes', () => {
    const body = skeleton()
    SetMeshBody(body, true)
    const shoulder = body.getObjectByName('left_shoulder')!
    const elbow = body.getObjectByName('left_elbow')!
    shoulder.rotation.z = Math.PI / 3
    elbow.position.set(8, -35, 4)
    UpdateMeshBody(body)
    body.updateMatrixWorld(true)
    const mesh = body.getObjectByName('mannequin_left_shoulder')!
    const midpoint = shoulder
        .getWorldPosition(new THREE.Vector3())
        .add(elbow.getWorldPosition(new THREE.Vector3()))
        .multiplyScalar(0.5)
    assert.ok(
        mesh.getWorldPosition(new THREE.Vector3()).distanceTo(midpoint) < 1e-8
    )
    assert.ok(Math.abs(mesh.scale.y - elbow.position.length() * 0.56) < 1e-8)
})

test('duplicated mannequins have independent transforms and shared geometry', () => {
    const body = skeleton()
    SetMeshBody(body, true)
    const clone = body.clone(true)
    assert.ok(HasMeshBody(clone))
    clone.getObjectByName('left_elbow')!.position.y = -50
    UpdateMeshBody(clone)
    const original = body.getObjectByName(
        'mannequin_left_shoulder'
    ) as THREE.Mesh
    const duplicate = clone.getObjectByName(original.name) as THREE.Mesh
    assert.notEqual(original.scale.y, duplicate.scale.y)
    assert.equal(original.geometry, duplicate.geometry)
    SetMeshBody(clone, false)
    assert.equal(meshes(body).length, 21)
})

test('degenerate limb lengths do not produce invalid transforms', () => {
    const body = skeleton()
    SetMeshBody(body, true)
    body.getObjectByName('left_elbow')!.position.set(0, 0, 0)
    UpdateMeshBody(body)
    for (const mesh of meshes(body)) {
        assert.ok(
            [
                ...mesh.position.toArray(),
                ...mesh.quaternion.toArray(),
                ...mesh.scale.toArray(),
            ].every(Number.isFinite)
        )
    }
})
