import * as React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import HeaderLeftContent from './components/headerLeftContent';
import HeaderRightContent from './components/headerRightContent';
import { MEASUREMENT } from 'src/const/theme/measurement';



const { useRef, useState, useEffect, useMemo } = React;

const HeaderSection = styled.section`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  height: ${MEASUREMENT.LEETECHO_HEADER_HEIGHT};
`;

interface HeaderProps {

}

const Header: React.FC<HeaderProps> = (props: HeaderProps) => {
  const { } = props;

  return (
    <HeaderSection>
      <HeaderLeftContent></HeaderLeftContent>
      <HeaderRightContent></HeaderRightContent>
    </HeaderSection>
  );
};

export default Header;