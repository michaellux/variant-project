<script lang="ts" setup>
import { useControls, TresLeches } from '@tresjs/leches'
import '@tresjs/leches/styles';
import { Vector3, TorusGeometry, MeshBasicMaterial, Mesh } from 'three';
import sources from '../sources';

const emit = defineEmits(['addmesh'])

const addMesh = () => {
  emit('addmesh');
};

const MeshControl = useControls({
  mesh: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.type === 'model')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  addMeshBtn: {
    label: 'Add mesh',
    type: 'button',
    onClick: addMesh,
    size: 'md',
  },
  position: new Vector3(0,0,0),
  albedo: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.subtype === 'albedo')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  roughness: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.subtype === 'roughness')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  metalness: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.subtype === 'metalness')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  normal: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.subtype === 'normal')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  sheen: {
    label: '',
    value: '',
    options: sources
    .filter((source) => source.subtype === 'sheen')
    .map(source => ({
      text: source.name,
      value: source.name,
    }))
  },
  deleteMeshBtn: {
    label: 'Delete mesh',
    type: 'button',
    onClick: () => {
      console.log('delete mesh');
    },
    size: 'md',
  },
})
</script>

<template>
  <TresLeches style="position: absolute;
    z-index: 9;
    right: 1.5rem;
    top: 1.5rem;"/>
</template>