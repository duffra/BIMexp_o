import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'viewer.js',
  output: [
    {
      format: 'esm',
      file: './dist/bundle.js'
    },
  ],
  plugins: [
    resolve(),
  ]
};