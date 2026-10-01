module.exports = ({ env }) => ({
  'chef-simon-kit': {
    enabled: true,
    resolve: './src/plugins/chef-simon-kit',
  },
  'thermomix-suggester': {
    enabled: true,
    resolve: './src/plugins/thermomix-suggester',
  },
});

