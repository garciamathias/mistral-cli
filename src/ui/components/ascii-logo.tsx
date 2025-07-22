import React from 'react';
import { Box } from 'ink';
import Gradient from 'ink-gradient';
import { shortAsciiLogo } from '../utils/ascii-art';

const AsciiLogo: React.FC = () => {
  return (
    <Box marginBottom={1}>
      <Gradient colors={['#9f521a', '#ffd800', '#fffaeb']}>
        {shortAsciiLogo}
      </Gradient>
    </Box>
  );
};

export default AsciiLogo;