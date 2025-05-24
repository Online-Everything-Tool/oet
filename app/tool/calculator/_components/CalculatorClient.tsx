'use client';

import React, { useState, useCallback } from 'react';
import useToolState from '../../_hooks/useToolState';
import Button from '../../_components/form/Button';
import type { ToolMetadata } from '@/src/types/tools';
import importedMetadata from '../metadata.json';

interface CalculatorState {
  displayValue: string;
  previousValue: number | null;
  currentOperation: string | null;
}

const DEFAULT_CALCULATOR_STATE: CalculatorState = {
  displayValue: '0',
  previousValue: null,
  currentOperation: null,
};

const metadata = importedMetadata as ToolMetadata;
const toolRoute = '/tool/' + metadata.directive;

export default function CalculatorClient() {
  const { state: toolState, setState: setToolState } = useToolState<CalculatorState>(toolRoute, DEFAULT_CALCULATOR_STATE);

  const handleNumberClick = useCallback((number: string) => {
    setToolState((prevState) => ({
      ...prevState,
      displayValue: prevState.displayValue === '0' ? number : prevState.displayValue + number,
    }));
  }, [setToolState]);

  const handleOperationClick = useCallback((operation: string) => {
    setToolState((prevState) => ({
      ...prevState,
      previousValue: parseFloat(prevState.displayValue),
      currentOperation: operation,
      displayValue: '0',
    }));
  }, [setToolState]);

  const handleEqualsClick = useCallback(() => {
    setToolState((prevState) => {
      const currentValue = parseFloat(prevState.displayValue);
      let newValue = prevState.previousValue;

      if (prevState.currentOperation && prevState.previousValue !== null) {
        switch (prevState.currentOperation) {
          case '+':
            newValue = prevState.previousValue + currentValue;
            break;
          case '-':
            newValue = prevState.previousValue - currentValue;
            break;
          case '*':
            newValue = prevState.previousValue * currentValue;
            break;
          case '/':
            newValue = prevState.previousValue / currentValue;
            break;
        }
      }
      return {
        ...prevState,
        displayValue: String(newValue),
        previousValue: newValue,
        currentOperation: null,
      };
    });
  }, [setToolState]);

  const handleClearClick = useCallback(() => {
    setToolState(DEFAULT_CALCULATOR_STATE);
  }, [setToolState]);

  const handleDecimalClick = useCallback(() => {
    setToolState((prevState) => ({
      ...prevState,
      displayValue: prevState.displayValue.includes('.') ? prevState.displayValue : prevState.displayValue + '.',
    }));
  }, [setToolState]);

  return (
    <div className="grid grid-cols-4 gap-2 p-4 border rounded-md bg-[rgb(var(--color-bg-subtle))]">
      <div className="col-span-4 p-3 bg-[rgb(var(--color-bg-component))] border rounded-md text-right text-xl font-mono">
        {toolState.displayValue}
      </div>
      {['7', '8', '9', '/'].map((val) => (
        <Button key={val} variant="neutral" onClick={() => (val === '/' ? handleOperationClick(val) : handleNumberClick(val))}>
          {val}
        </Button>
      ))}
      {['4', '5', '6', '*'].map((val) => (
        <Button key={val} variant="neutral" onClick={() => (val === '*' ? handleOperationClick(val) : handleNumberClick(val))}>
          {val}
        </Button>
      ))}
      {['1', '2', '3', '-'].map((val) => (
        <Button key={val} variant="neutral" onClick={() => (val === '-' ? handleOperationClick(val) : handleNumberClick(val))}>
          {val}
        </Button>
      ))}
      {['0', '.', '=', '+'].map((val) => (
        <Button
          key={val}
          variant="neutral"
          onClick={() => {
            if (val === '=') handleEqualsClick();
            else if (val === '+') handleOperationClick(val);
            else if (val === '.') handleDecimalClick();
            else handleNumberClick(val);
          }}
        >
          {val}
        </Button>
      ))}
      <Button variant="danger" className="col-span-2" onClick={handleClearClick}>
        Clear
      </Button>
    </div>
  );
}